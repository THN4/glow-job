from dataclasses import replace
from datetime import date, datetime, timezone
from decimal import Decimal

from app.features.resume.career_matching import MarketSkill, UserSkill, calculate_match


def market_skill(
    skill_id: int,
    name: str,
    weight: str | None,
    target: str = "intermediate",
    *,
    confidence: str = "0.900",
    observations: int = 10,
    jobs: int = 100,
) -> MarketSkill:
    return MarketSkill(
        skill_id=skill_id,
        skill_name=name,
        demand_count=jobs // 2,
        total_jobs=jobs,
        demand_percentage=Decimal("50.00"),
        weighted_demand_score=Decimal(weight) if weight is not None else None,
        target_level=target,
        target_level_confidence=Decimal(confidence) if confidence is not None else None,
        level_observation_count=observations,
        importance_tier="core",
        analysis_start_date=date(2026, 1, 1),
        analysis_end_date=date(2026, 6, 30),
        last_updated=datetime(2026, 7, 1, tzinfo=timezone.utc),
    )


def run(
    users: list[UserSkill],
    markets: list[MarketSkill],
    unmatched: list[dict[str, str]] | None = None,
) -> dict:
    return calculate_match(
        12,
        users,
        markets,
        unmatched_user_skills=unmatched,
        min_total_jobs=10,
        max_market_age_days=180,
        min_level_observations=3,
        min_target_level_confidence=Decimal("0.6"),
    )


def test_coverage_is_weighted_and_proficiency_is_a_separate_score():
    result = run(
        [
            UserSkill(1, "intermediate", "explicit"),
            UserSkill(2, "beginner", "inferred"),
        ],
        [
            market_skill(1, "Python", "0.8", "advanced"),
            market_skill(2, "SQL", "0.6", "beginner"),
            market_skill(3, "Kubernetes", "0.2", "expert"),
        ],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 87.5
    assert result["scores"]["proficiencyAlignmentPct"] == 80.95
    assert result["scores"]["assessmentCoveragePct"] == 87.5
    assert result["status"] == "estimated"
    by_name = {skill["skillName"]: skill for skill in result["skills"]}
    assert by_name["Python"]["status"] == "proficiency_gap"
    assert by_name["Python"]["levelGap"] == 1
    assert by_name["Kubernetes"]["status"] == "missing_from_profile"


def test_unknown_user_level_is_not_treated_as_beginner():
    result = run(
        [UserSkill(1, "unknown", "unknown")],
        [market_skill(1, "Python", "0.8")],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 100.0
    assert result["scores"]["proficiencyAlignmentPct"] is None
    assert result["scores"]["assessmentCoveragePct"] == 0.0
    assert result["skills"][0]["status"] == "not_assessed"
    assert result["skills"][0]["reasonCode"] == "USER_PROFICIENCY_UNKNOWN"


def test_low_confidence_market_target_does_not_create_a_proficiency_gap():
    result = run(
        [UserSkill(1, "beginner", "inferred")],
        [market_skill(1, "Python", "0.8", "expert", confidence="0.4")],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 100.0
    assert result["scores"]["proficiencyAlignmentPct"] is None
    assert result["skills"][0]["status"] == "market_data_insufficient"
    assert result["skills"][0]["reasonCode"] == "MARKET_TARGET_LEVEL_LOW_CONFIDENCE"


def test_unknown_market_target_level_is_not_compared_to_user_level():
    result = run(
        [UserSkill(1, "beginner", "explicit")],
        [market_skill(1, "Python", "0.8", "unknown")],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 100.0
    assert result["scores"]["proficiencyAlignmentPct"] is None
    assert result["skills"][0]["reasonCode"] == "MARKET_TARGET_LEVEL_UNKNOWN"


def test_missing_market_weights_are_not_silently_counted_as_zero():
    result = run(
        [],
        [
            market_skill(1, "Python", "0.8"),
            market_skill(2, "SQL", None),
        ],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 0.0
    assert result["skillSummary"]["excludedMarketSkills"] == 1
    assert result["skills"][1]["reasonCode"] == "MARKET_WEIGHT_UNAVAILABLE"
    assert result["status"] == "estimated"


def test_empty_market_data_returns_insufficient_status_without_fake_zero_score():
    result = run([], [])

    assert result["status"] == "insufficient_market_data"
    assert result["scores"]["marketSkillCoveragePct"] is None
    assert result["skills"] == []


def test_all_missing_market_weights_return_insufficient_status():
    result = run([], [market_skill(1, "Python", None)])

    assert result["status"] == "insufficient_market_data"
    assert result["scores"]["marketSkillCoveragePct"] is None


def test_small_market_sample_is_disclosed_even_when_scores_can_be_calculated():
    result = run([], [market_skill(1, "Python", "0.8", jobs=5)])

    assert result["scores"]["marketSkillCoveragePct"] == 0.0
    assert result["status"] == "estimated"
    assert any("small (5 jobs" in warning for warning in result["warnings"])


def test_stale_market_window_is_disclosed():
    stale = replace(
        market_skill(1, "Python", "0.8"),
        last_updated=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    result = run([], [stale])

    assert result["status"] == "estimated"
    assert any("statistics are stale" in warning for warning in result["warnings"])


def test_evidence_is_limited_and_unmatched_skills_are_kept_out_of_score():
    evidence = tuple(
        {"type": "project", "text": "x" * 400, "confidence": Decimal("0.9")}
        for _ in range(4)
    )
    result = run(
        [UserSkill(1, "intermediate", "explicit", evidence)],
        [market_skill(1, "Python", "0.8")],
        [{"rawSkillName": "Unknown Tool", "matchStatus": "needs_review"}],
    )

    assert result["scores"]["marketSkillCoveragePct"] == 100.0
    assert result["unmatchedUserSkills"] == [
        {"rawSkillName": "Unknown Tool", "matchStatus": "needs_review"}
    ]
    assert len(result["skills"][0]["evidence"]) == 3
    assert len(result["skills"][0]["evidence"][0]["excerpt"]) == 320
