"""Behavior checks for ambiguous skill data and independent market denominators."""

from datetime import date, datetime, timezone
from decimal import Decimal
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from rag.context.models import (
    Background, CareerProfile, ConfirmedSkill, ContextInputs, Goal, MarketInputs,
    MarketSkill, MarketWindow, UnresolvedSkill, UserInputs,
)
from rag.context.scoring_experiment import compare_policies, format_report
from scripts.rag.compare_match_policies import main as compare_main


def snapshot(weights=(0.6, 0.2, 0.1, 0.1)):
    return ContextInputs(
        career=CareerProfile(
            career_id=10, career_profile_id=12, career_name="Data Engineer",
            profile_name="Junior Data Engineer", seniority_level="junior",
        ),
        market=MarketInputs(
            career_profile_id=12,
            window=MarketWindow(
                analysis_start_date=date(2026, 9, 1), analysis_end_date=date(2026, 9, 30),
                analysis_date_basis="posted_at",
            ),
            skills=tuple(MarketSkill(
                skill_id=index + 1, skill_name=f"Skill {index + 1}", demand_count=10,
                total_jobs=20, demand_percentage=50, required_count=8, preferred_count=2,
                optional_count=0, weighted_demand_score=weight, target_level="unknown",
                last_updated=datetime(2026, 10, 1, tzinfo=timezone.utc),
            ) for index, weight in enumerate(weights)),
        ),
    )


def saved_snapshot(weights=(0.6, 0.2, 0.1, 0.1)):
    base = snapshot(weights)
    return base.model_copy(update={"user": UserInputs(
        profile_id="prf_private_identity", background=Background(current_job_title="Private CV title"),
        confirmed_skills=tuple(ConfirmedSkill(
            skill_id=skill_id, skill_name="Private skill label", raw_skill_name="Private raw label",
            proficiency_level="advanced" if skill_id == 3 else "unknown",
            proficiency_basis="explicit" if skill_id == 3 else "unknown",
        ) for skill_id in (1, 3, 99)),
        unresolved_skills=(UnresolvedSkill(
            raw_skill_name="Skill 2", match_status="needs_review", proficiency_level="advanced",
        ),),
    )})


class ContextContractTests(unittest.TestCase):
    def test_unknown_and_unresolved_are_preserved_without_inventing_ids(self):
        user = UserInputs(
            profile_id="prf_example", background=Background(),
            confirmed_skills=(ConfirmedSkill(
                skill_id=1, skill_name="Python", raw_skill_name="python",
                proficiency_level="unknown", proficiency_basis="unknown",
            ),),
            unresolved_skills=(UnresolvedSkill(
                raw_skill_name="new label", match_status="needs_review", proficiency_level="unknown",
            ),),
        )
        result = UserInputs.model_validate_json(user.model_dump_json())
        self.assertEqual(result.confirmed_skills[0].proficiency_level, "unknown")
        self.assertNotIn("skill_id", result.unresolved_skills[0].model_dump())

    def test_duplicate_canonical_skill_rejected(self):
        skill = ConfirmedSkill(
            skill_id=1, skill_name="Python", raw_skill_name="python",
            proficiency_level="unknown", proficiency_basis="unknown",
        )
        with self.assertRaises(ValidationError):
            UserInputs(profile_id="p", background=Background(), confirmed_skills=(skill, skill))

    def test_market_percentage_cannot_silently_use_fractional_units(self):
        values = snapshot().market.skills[0].model_dump()
        values["demand_percentage"] = 0.5
        with self.assertRaises(ValidationError):
            MarketSkill.model_validate(values)

    def test_market_snapshot_requires_one_explicit_cohort(self):
        data = snapshot().market.model_dump()
        data["skills"][1]["total_jobs"] = 25
        data["skills"][1]["demand_percentage"] = 40
        with self.assertRaises(ValidationError):
            MarketInputs.model_validate(data)
        with self.assertRaises(ValidationError):
            MarketInputs(career_profile_id=12, skills=snapshot().market.skills)

    def test_saved_goal_cannot_be_applied_to_another_career(self):
        data = snapshot().model_dump()
        data["user"] = UserInputs(
            profile_id="p", background=Background(),
            goal=Goal(goal_id=1, career_id=10, career_profile_id=99, target_role_title="Other"),
        ).model_dump()
        with self.assertRaises(ValidationError):
            ContextInputs.model_validate(data)


class CoverageExperimentTests(unittest.TestCase):
    def test_saved_profile_uses_actual_ids_and_excludes_unresolved_and_outside_skills(self):
        report = compare_policies(saved_snapshot(), top_count=1)
        user = report["saved_profile"]
        self.assertEqual(user["scores"], {
            "existing_weighted_coverage": 70,
            "top_weight_count_with_ties": 100,
            "cumulative_weight_with_ties": 75,
        })
        self.assertEqual(user["confirmed_skill_count"], 3)
        self.assertEqual(user["unresolved_skill_count"], 1)
        self.assertEqual(user["skills_outside_weighted_market_count"], 1)
        self.assertEqual(user["known_proficiency_count"], 1)
        self.assertEqual(user["unknown_proficiency_count"], 2)
        self.assertEqual(user["covered_skill_counts"]["existing_weighted_coverage"], 2)
        self.assertEqual(len(report["scenarios"]), 6)

    def test_saved_profile_does_not_change_market_denominator(self):
        self.assertEqual(
            compare_policies(snapshot(), top_count=1)["policies"],
            compare_policies(saved_snapshot(), top_count=1)["policies"],
        )

    def test_saved_unknown_levels_have_same_presence_scores(self):
        base = saved_snapshot()
        unknown = base.user.model_copy(update={"confirmed_skills": tuple(
            skill.model_copy(update={"proficiency_level": "unknown", "proficiency_basis": "unknown"})
            for skill in base.user.confirmed_skills
        )})
        result = compare_policies(base.model_copy(update={"user": unknown}))["saved_profile"]
        self.assertEqual(result["scores"], compare_policies(base)["saved_profile"]["scores"])
        self.assertEqual(result["known_proficiency_count"], 0)

    def test_saved_empty_profile_scores_zero_only_with_positive_market_weight(self):
        base = snapshot().model_copy(update={"user": UserInputs(profile_id="p", background=Background())})
        self.assertTrue(all(value == 0 for value in compare_policies(base)["saved_profile"]["scores"].values()))
        no_market = saved_snapshot(())
        self.assertTrue(all(value is None for value in compare_policies(no_market)["saved_profile"]["scores"].values()))
        self.assertIn("N/A", format_report(compare_policies(no_market)))

    def test_saved_report_separates_real_input_from_synthetic_and_omits_identity(self):
        report = compare_policies(saved_snapshot(), top_count=1)
        rendered = format_report(report)
        self.assertIn("ผลจากโปรไฟล์ที่บันทึกแล้ว", rendered)
        self.assertIn("ผลจากโปรไฟล์สมมติ", rendered)
        self.assertIn("70.00%", rendered)
        for private in ("prf_private_identity", "Private CV title", "Private raw label", "Private skill label"):
            self.assertNotIn(private, rendered + json.dumps(report))
        self.assertIsNone(compare_policies(snapshot())["saved_profile"])

    def test_core_only_can_be_perfect_under_filtered_denominator_but_not_original(self):
        report = compare_policies(snapshot(), top_count=1, cumulative_share=Decimal("0.8"))
        case = next(row for row in report["scenarios"] if row["scenario"] == "top_weight_skills_only")
        self.assertEqual(case["scores"]["existing_weighted_coverage"], 60)
        self.assertEqual(case["scores"]["top_weight_count_with_ties"], 100)
        self.assertEqual(case["scores"]["cumulative_weight_with_ties"], 75)

    def test_unknown_levels_do_not_lower_skill_presence_coverage(self):
        report = compare_policies(snapshot(), top_count=1)
        cases = {row["scenario"]: row for row in report["scenarios"]}
        known = cases["top_weight_skills_only"]
        unknown = cases["top_weight_skills_unknown_levels"]
        self.assertEqual(known["scores"], unknown["scores"])
        self.assertEqual(unknown["known_proficiency_count"], 0)

    def test_ties_not_arbitrarily_split_at_selection_boundary(self):
        report = compare_policies(snapshot((0.4, 0.2, 0.2, 0.2)), top_count=2)
        self.assertEqual(report["policies"][1]["selected_skills"], 4)
        self.assertEqual(report["policies"][2]["selected_skills"], 4)

    def test_empty_or_zero_weights_do_not_report_zero_readiness(self):
        report = compare_policies(snapshot((0, 0)))
        for case in report["scenarios"]:
            self.assertTrue(all(score is None for score in case["scores"].values()))

    def test_invalid_experiment_parameters_fail_even_without_market_rows(self):
        empty = snapshot(())
        with self.assertRaises(ValueError):
            compare_policies(empty, top_count=0)
        with self.assertRaises(ValueError):
            compare_policies(empty, cumulative_share=Decimal("0"))

    def test_denominator_does_not_depend_on_profile_availability(self):
        base = snapshot()
        def for_hours(hours):
            return ContextInputs(
                career=base.career, market=base.market,
                user=UserInputs(
                    profile_id="p", background=Background(),
                    goal=Goal(goal_id=1, career_id=10, career_profile_id=12,
                              target_role_title="Data Engineer", available_hours_per_week=hours),
                ),
            )
        self.assertEqual(compare_policies(for_hours(2)), compare_policies(for_hours(10)))


class ComparisonCliTests(unittest.TestCase):
    def test_saved_profile_argument_reaches_read_only_repository(self):
        with TemporaryDirectory() as folder:
            output = Path(folder) / "comparison.md"
            with patch("sys.argv", ["compare", "--career-profile-id", "12", "--profile-id", "prf_saved",
                                    "--date-basis", "first_seen_at", "--output", str(output)]), \
                 patch("scripts.rag.compare_match_policies.connect") as connect, \
                 patch("scripts.rag.compare_match_policies.load_inputs", return_value=saved_snapshot()) as load, \
                 redirect_stdout(StringIO()) as stdout:
                self.assertEqual(compare_main(), 0)
            load.assert_called_once_with(
                connect.return_value.__enter__.return_value,
                career_profile_id=12, profile_id="prf_saved", date_basis="first_seen_at",
            )
            self.assertIsNotNone(json.loads(stdout.getvalue())["savedProfile"])
            self.assertIn("ผลจากโปรไฟล์ที่บันทึกแล้ว", output.read_text(encoding="utf-8"))

    def test_input_file_preserves_saved_user_without_database_connection(self):
        with TemporaryDirectory() as folder:
            source, output = Path(folder) / "inputs.json", Path(folder) / "comparison.md"
            source.write_text(saved_snapshot().model_dump_json(), encoding="utf-8")
            with patch("sys.argv", ["compare", "--input", str(source), "--output", str(output)]), \
                 patch("scripts.rag.compare_match_policies.connect") as connect, \
                 redirect_stdout(StringIO()) as stdout:
                self.assertEqual(compare_main(), 0)
            connect.assert_not_called()
            self.assertEqual(json.loads(stdout.getvalue())["savedProfile"]["confirmed_skill_count"], 3)

    def test_input_file_cannot_silently_override_profile_argument(self):
        with patch("sys.argv", ["compare", "--input", "inputs.json", "--profile-id", "prf_saved", "--output", "out.md"]), \
             redirect_stderr(StringIO()) as stderr:
            with self.assertRaises(SystemExit) as error:
                compare_main()
        self.assertEqual(error.exception.code, 2)
        self.assertIn("--profile-id requires --career-profile-id", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
