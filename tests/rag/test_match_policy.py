from datetime import date, datetime, timezone
from decimal import Decimal
import unittest

from rag.context.assemble import score_market
from rag.context.agent_models import GapAssessment, MarketSkillAssessment
from rag.context.match_policy import (
    calculate_gap_score, calculate_priority_score, select_core_skills,
)
from rag.context.models import (
    CareerProfile, ConfirmedSkill, ContextInputs, MarketInputs, MarketSkill,
    MarketWindow, UserInputs, Background,
)


def market_skill(skill_id, name, weight, target="intermediate", *, confidence=0.9, observations=5):
    return MarketSkill(
        skill_id=skill_id, skill_name=name, demand_count=8, total_jobs=20,
        demand_percentage=40, required_count=6, preferred_count=2, optional_count=0,
        weighted_demand_score=weight, target_level=target,
        target_level_confidence=confidence, level_observation_count=observations,
        importance_tier="unknown", last_updated=datetime(2026, 10, 1, tzinfo=timezone.utc),
    )


def inputs_with(skills, confirmed):
    return ContextInputs(
        career=CareerProfile(
            career_id=1, career_profile_id=12, career_name="Engineering",
            profile_name="Engineer", seniority_level="junior",
        ),
        market=MarketInputs(
            career_profile_id=12,
            window=MarketWindow(
                analysis_start_date=date(2026, 1, 1), analysis_end_date=date(2026, 10, 1),
                analysis_date_basis="first_seen_at",
            ),
            skills=tuple(skills),
        ),
        user=UserInputs(profile_id="prf_test", background=Background(), confirmed_skills=tuple(confirmed)),
    )


class MatchPolicyTests(unittest.TestCase):
    def test_core_selection_keeps_the_full_tie_group_at_limit(self):
        rows = [market_skill(i, f"Skill {i:02}", 0.5 if i <= 19 else 0.2)
                for i in range(1, 22)]
        selected = select_core_skills(rows, limit=20)
        self.assertEqual(len(selected), 21)
        self.assertIn(21, {item.skill_id for item in selected})

    def test_gap_and_priority_scores_preserve_unknowns(self):
        self.assertEqual(calculate_gap_score("missing_from_profile", None), Decimal(1))
        self.assertEqual(calculate_gap_score("proficiency_gap", 1), Decimal(1) / Decimal(3))
        self.assertEqual(calculate_gap_score("covered", 0), Decimal(0))
        self.assertIsNone(calculate_gap_score("not_assessed", None))
        self.assertIsNone(calculate_priority_score(Decimal("0.5"), Decimal("1"), None))
        self.assertEqual(
            calculate_priority_score(Decimal("0.25"), Decimal("1"), Decimal(1)), Decimal("25.00")
        )

    def test_full_market_scores_separate_presence_level_fit_and_assessment_coverage(self):
        market = [
            market_skill(1, "Python", 0.6, "advanced"),
            market_skill(2, "Spark", 0.3, "intermediate"),
            market_skill(3, "Cloud", 0.1, "expert"),
        ]
        user = [
            ConfirmedSkill(skill_id=1, skill_name="Python", raw_skill_name="Python",
                           proficiency_level="intermediate", proficiency_basis="explicit"),
            ConfirmedSkill(skill_id=3, skill_name="Cloud", raw_skill_name="Cloud",
                           proficiency_level="unknown", proficiency_basis="unknown"),
        ]
        assessments, scores = score_market(inputs_with(market, user), user)
        self.assertEqual(scores.metrics.core_skill_match_pct, 70.0)
        self.assertEqual(scores.metrics.market_skill_coverage_pct, 70.0)
        self.assertEqual(scores.metrics.proficiency_alignment_pct, 66.67)
        self.assertEqual(scores.metrics.assessment_coverage_pct, 60.0)
        self.assertEqual(scores.status, "estimated")
        by_id = {item.market.skill_id: item for item in assessments}
        self.assertEqual(by_id[1].gap.status, "proficiency_gap")
        self.assertAlmostEqual(by_id[1].gap.gap_score, 1 / 3)
        self.assertEqual(by_id[2].gap.status, "missing_from_profile")
        self.assertEqual(by_id[2].gap.gap_score, 1.0)
        self.assertEqual(by_id[2].priority_score, 30.0)
        self.assertEqual(by_id[2].priority_rank, 1)
        self.assertEqual(by_id[3].gap.status, "not_assessed")
        self.assertIsNone(by_id[3].gap.gap_score)
        self.assertIsNone(by_id[3].priority_rank)

    def test_market_target_below_quality_gate_does_not_create_level_gap(self):
        market = [market_skill(1, "Python", 1, "expert", confidence=0.4, observations=2)]
        user = [ConfirmedSkill(skill_id=1, skill_name="Python", raw_skill_name="Python",
                               proficiency_level="beginner", proficiency_basis="explicit")]
        assessments, scores = score_market(inputs_with(market, user), user)
        self.assertEqual(assessments[0].gap.status, "market_data_insufficient")
        self.assertIsNone(assessments[0].gap.gap_score)
        self.assertIsNone(scores.metrics.proficiency_alignment_pct)
        self.assertEqual(scores.metrics.assessment_coverage_pct, 0.0)

    def test_market_assessment_requires_core_and_priority_ranks_to_be_complete(self):
        row = market_skill(1, "Python", 1)
        gap = GapAssessment(status="missing_from_profile", current_level=None,
                            target_level="intermediate", gap_score=1,
                            requires_confirmation=True, reason_code="SKILL_NOT_FOUND")
        with self.assertRaises(ValueError):
            MarketSkillAssessment(market=row, gap=gap, is_core_skill=True,
                                  core_rank=None, priority_score=100)
        with self.assertRaises(ValueError):
            MarketSkillAssessment(market=row, gap=gap, is_core_skill=True,
                                  core_rank=1, priority_score=100, priority_rank=None)
        assessed = MarketSkillAssessment(market=row, gap=gap, is_core_skill=True,
                                         core_rank=1, priority_score=100, priority_rank=1)
        self.assertEqual(assessed.priority_rank, 1)


if __name__ == "__main__":
    unittest.main()
