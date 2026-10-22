"""Versioned, deterministic market match and gap scoring policy.

This policy mirrors the Resume career-match calculation and is shared by the
Agent Context assembler so both outputs use the same core-skill denominator.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable, TypeVar


CORE_SKILL_LIMIT = 20
CORE_SKILL_POLICY_VERSION = "weighted-top-20-with-cutoff-ties-v1"
GAP_SCORE_POLICY_VERSION = "ordinal-gap-over-three-v1"
PRIORITY_SCORE_POLICY_VERSION = "core-weighted-gap-share-v1"
MATCH_MIN_TOTAL_JOBS = 10
MATCH_MAX_MARKET_AGE_DAYS = 180
MATCH_MIN_LEVEL_OBSERVATIONS = 3
MATCH_MIN_TARGET_LEVEL_CONFIDENCE = Decimal("0.6")

LEVEL_INDEX = {
    "beginner": 0,
    "intermediate": 1,
    "advanced": 2,
    "expert": 3,
}

T = TypeVar("T")


def market_weight(skill: object) -> Decimal:
    """Return positive market weight as Decimal; missing weights count as zero."""
    value = getattr(skill, "weighted_demand_score", None)
    return Decimal(str(value)) if value is not None and value > 0 else Decimal(0)


def select_core_skills(skills: Iterable[T], *, limit: int = CORE_SKILL_LIMIT) -> list[T]:
    """Sort positive-weight skills and include the full tie group at the cutoff."""
    if limit < 1:
        raise ValueError("Core skill limit must be positive")
    ranked = sorted(
        (skill for skill in skills if market_weight(skill) > 0),
        key=lambda skill: (-market_weight(skill), getattr(skill, "skill_name").casefold(),
                           getattr(skill, "skill_id")),
    )
    if len(ranked) <= limit:
        return ranked
    cutoff = market_weight(ranked[limit - 1])
    return [skill for skill in ranked if market_weight(skill) >= cutoff]


def calculate_gap_score(status: str, level_gap: int | None) -> Decimal | None:
    """Potential missing skill gets 1; unknown evidence stays null."""
    if status == "missing_from_profile":
        return Decimal(1)
    if status == "proficiency_gap" and level_gap is not None and level_gap > 0:
        return Decimal(level_gap) / Decimal(3)
    if status == "covered":
        return Decimal(0)
    return None


def calculate_priority_score(weight: Decimal, total_core_weight: Decimal,
                             gap_score: Decimal | None) -> Decimal | None:
    """Weighted gap contribution in percentage points of total core demand."""
    if weight <= 0 or total_core_weight <= 0 or gap_score is None:
        return None
    return Decimal(100) * gap_score * weight / total_core_weight


def level_gap(user_level: str, target_level: str) -> int | None:
    if user_level not in LEVEL_INDEX or target_level not in LEVEL_INDEX:
        return None
    return max(0, LEVEL_INDEX[target_level] - LEVEL_INDEX[user_level])


def level_fit(user_level: str, target_level: str) -> Decimal | None:
    gap = level_gap(user_level, target_level)
    if gap is None:
        return None
    return max(Decimal(0), Decimal(1) - Decimal(gap) / Decimal(3))


def as_percentage(numerator: Decimal, denominator: Decimal) -> float | None:
    if denominator <= 0:
        return None
    return float((Decimal(100) * numerator / denominator).quantize(Decimal("0.01")))
