"""Deterministic comparison of a confirmed Resume profile with Market skills."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from app.features.resume.errors import AppError
from rag.context.match_policy import (
    CORE_SKILL_LIMIT,
    LEVEL_INDEX as _LEVEL_INDEX,
    calculate_gap_score,
    calculate_priority_score,
    level_fit as calculate_level_fit,
    select_core_skills,
)

if TYPE_CHECKING:
    import psycopg
    from app.features.resume.config import CvSettings

log = logging.getLogger("cv_extraction")

# Levels the learner stated in the CV or confirmed in a skill check need no further confirmation.
CONFIRMED_BASES = {"explicit", "assessed", "self_reported"}

@dataclass(frozen=True)
class UserSkill:
    skill_id: int
    proficiency_level: str
    proficiency_basis: str
    evidence: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class MarketSkill:
    skill_id: int
    skill_name: str
    demand_count: int
    total_jobs: int
    demand_percentage: Decimal
    weighted_demand_score: Decimal | None
    target_level: str
    target_level_confidence: Decimal | None
    level_observation_count: int
    importance_tier: str
    analysis_start_date: date
    analysis_end_date: date
    last_updated: datetime


def calculate_match(
    career_profile_id: int,
    user_skills: list[UserSkill],
    market_skills: list[MarketSkill],
    *,
    unmatched_user_skills: list[dict[str, str]] | None = None,
    min_total_jobs: int,
    max_market_age_days: int,
    min_level_observations: int,
    min_target_level_confidence: Decimal,
) -> dict[str, Any]:
    """Calculate separate market-presence and proficiency scores.

    User skills passed here must already be canonical, matched and confirmed.
    Null/zero market weights are excluded from score denominators rather than
    interpreted as zero demand.
    """
    if not market_skills:
        return {
            "careerProfileId": career_profile_id,
            "marketWindow": None,
            "marketSample": {"totalJobs": 0, "lastUpdated": None},
            "status": "insufficient_market_data",
            "scores": {
                "coreSkillMatchPct": None,
                "marketSkillCoveragePct": None,
                "proficiencyAlignmentPct": None,
                "assessmentCoveragePct": None,
            },
            "skillSummary": {
                "considered": 0,
                "coreConsidered": 0,
                "coreCovered": 0,
                "covered": 0,
                "missingFromProfile": 0,
                "notAssessed": 0,
                "marketDataInsufficient": 0,
                "excludedMarketSkills": 0,
            },
            "coreSkillPolicy": {
                "version": "weighted-top-20-with-cutoff-ties-v1",
                "nominalLimit": CORE_SKILL_LIMIT,
                "includedCount": 0,
            },
            "skills": [],
            "unmatchedUserSkills": unmatched_user_skills or [],
            "warnings": ["No market skill statistics are available for this career profile."],
        }

    confirmed_by_id = {skill.skill_id: skill for skill in user_skills}
    usable_rows = [
        skill
        for skill in market_skills
        if skill.weighted_demand_score is not None and skill.weighted_demand_score > 0
    ]
    total_weight = sum(
        (
            skill.weighted_demand_score
            for skill in usable_rows
            if skill.weighted_demand_score is not None
        ),
        Decimal(0),
    )
    core_rows = select_core_skills(usable_rows, limit=CORE_SKILL_LIMIT)
    core_ids = {skill.skill_id for skill in core_rows}
    core_rank_by_id = {skill.skill_id: index for index, skill in enumerate(core_rows, 1)}
    weight_by_id = {skill.skill_id: skill.weighted_demand_score for skill in usable_rows}
    total_core_weight = sum(
        (skill.weighted_demand_score or Decimal(0) for skill in core_rows), Decimal(0)
    )
    core_coverage_weight = Decimal(0)
    market_coverage_weight = Decimal(0)
    proficiency_weight = Decimal(0)
    proficiency_total_weight = Decimal(0)
    skill_results: list[dict[str, Any]] = []
    counts = {
        "considered": len(usable_rows),
        "coreConsidered": len(core_rows),
        "coreCovered": 0,
        "covered": 0,
        "missingFromProfile": 0,
        "notAssessed": 0,
        "marketDataInsufficient": 0,
        "excludedMarketSkills": len(market_skills) - len(usable_rows),
    }

    for market in market_skills:
        weight = market.weighted_demand_score
        if weight is None or weight <= 0:
            user_skill = confirmed_by_id.get(market.skill_id)
            skill_results.append(_market_skill_body(market) | {
                "userHasSkill": user_skill is not None,
                "userProficiencyLevel": user_skill.proficiency_level if user_skill else None,
                "proficiencyBasis": user_skill.proficiency_basis if user_skill else None,
                "evidence": _evidence_body(user_skill.evidence) if user_skill else [],
                "status": "market_data_insufficient",
                "reasonCode": "MARKET_WEIGHT_UNAVAILABLE",
                "levelGap": None,
                "levelFit": None,
                "isCoreSkill": False,
                "coreRank": None,
                "gapScore": None,
                "priorityScore": None,
                "priorityRank": None,
                "requiresConfirmation": bool(
                    user_skill and user_skill.proficiency_basis not in CONFIRMED_BASES
                ),
            })
            counts["marketDataInsufficient"] += 1
            continue

        user_skill = confirmed_by_id.get(market.skill_id)
        has_skill = user_skill is not None
        if has_skill:
            counts["covered"] += 1
            market_coverage_weight += weight
            if market.skill_id in core_ids:
                core_coverage_weight += weight
                counts["coreCovered"] += 1
            status = "covered"
            reason_code = "SKILL_CONFIRMED"
        else:
            counts["missingFromProfile"] += 1
            status = "missing_from_profile"
            reason_code = "SKILL_NOT_FOUND_IN_CONFIRMED_PROFILE"

        level_fit: Decimal | None = None
        level_gap: int | None = None
        if has_skill:
            user_level = user_skill.proficiency_level
            if user_level not in _LEVEL_INDEX:
                status = "not_assessed"
                reason_code = "USER_PROFICIENCY_UNKNOWN"
                counts["notAssessed"] += 1
            elif market.target_level not in _LEVEL_INDEX:
                status = "market_data_insufficient"
                reason_code = "MARKET_TARGET_LEVEL_UNKNOWN"
                counts["marketDataInsufficient"] += 1
            elif (
                market.target_level_confidence is None
                or market.target_level_confidence < min_target_level_confidence
                or market.level_observation_count < min_level_observations
            ):
                status = "market_data_insufficient"
                reason_code = "MARKET_TARGET_LEVEL_LOW_CONFIDENCE"
                counts["marketDataInsufficient"] += 1
            else:
                level_gap = _LEVEL_INDEX[market.target_level] - _LEVEL_INDEX[user_level]
                level_fit = calculate_level_fit(user_level, market.target_level)
                proficiency_weight += weight * level_fit
                proficiency_total_weight += weight
                if level_gap > 0:
                    status = "proficiency_gap"
                    reason_code = "USER_LEVEL_BELOW_MARKET_TARGET"

        body = _market_skill_body(market)
        body.update({
            "userHasSkill": has_skill,
            "userProficiencyLevel": user_skill.proficiency_level if user_skill else None,
            "proficiencyBasis": user_skill.proficiency_basis if user_skill else None,
            "evidence": _evidence_body(user_skill.evidence) if user_skill else [],
            "status": status,
            "reasonCode": reason_code,
            "levelGap": level_gap,
            "levelFit": round(float(level_fit), 4) if level_fit is not None else None,
            "isCoreSkill": market.skill_id in core_ids,
            "coreRank": core_rank_by_id.get(market.skill_id),
        })
        skill_results.append(body)

    # This ordinal gap signal supports prioritization; it is not a calibrated
    # measure of ability. A missing profile entry is only a potential gap.
    priority_rows: list[tuple[Decimal, Decimal, str, int, dict[str, Any]]] = []
    for body in skill_results:
        gap_status = body["status"]
        gap_score: Decimal | None = None
        if body.get("isCoreSkill"):
            gap_score = calculate_gap_score(gap_status, body.get("levelGap"))
        if gap_score is None:
            body.update({
                "gapScore": None,
                "priorityScore": None,
                "priorityRank": None,
                "requiresConfirmation": gap_status in {"missing_from_profile", "not_assessed"} or (
                    body.get("userHasSkill") and body.get("proficiencyBasis") != "explicit"
                ),
            })
            continue
        market_weight = weight_by_id[body["skillId"]]
        priority = calculate_priority_score(market_weight, total_core_weight, gap_score)
        if priority is None:
            body.update({"gapScore": None, "priorityScore": None, "priorityRank": None})
            continue
        if priority <= 0:
            body.update({
                "gapScore": round(float(gap_score), 4),
                "priorityScore": 0.0,
                "priorityRank": None,
            })
            continue
        body.update({
            "gapScore": round(float(gap_score), 4),
            "priorityScore": round(float(priority), 4),
            "priorityRank": None,
            "requiresConfirmation": gap_status == "missing_from_profile" or (
                body.get("proficiencyBasis") != "explicit"
            ),
        })
        priority_rows.append((priority, market_weight, str(body["skillName"]).casefold(), body["skillId"], body))
    priority_rows.sort(key=lambda row: (-row[0], -row[1], row[2], row[3]))
    for rank, (_, _, _, _, body) in enumerate(priority_rows, 1):
        body["priorityRank"] = rank

    scores = {
        "coreSkillMatchPct": _percent(core_coverage_weight / total_core_weight)
        if total_core_weight > 0 else None,
        "marketSkillCoveragePct": _percent(market_coverage_weight / total_weight)
        if total_weight > 0 else None,
        "proficiencyAlignmentPct": _percent(proficiency_weight / proficiency_total_weight)
        if proficiency_total_weight > 0 else None,
        "assessmentCoveragePct": _percent(proficiency_total_weight / total_weight)
        if total_weight > 0 else None,
    }
    warnings: list[str] = []
    total_jobs = max(skill.total_jobs for skill in market_skills)
    if total_jobs < min_total_jobs:
        warnings.append(
            f"Market sample is small ({total_jobs} jobs; recommended minimum is {min_total_jobs})."
        )
    if counts["excludedMarketSkills"]:
        warnings.append(
            f"{counts['excludedMarketSkills']} market skills had a missing or zero weight "
            "and were excluded from score denominators."
        )
    if scores["assessmentCoveragePct"] is not None and scores["assessmentCoveragePct"] < 100:
        warnings.append(
            "Proficiency alignment covers only part of the market skill weight because "
            "some levels could not be assessed."
        )
    latest_updated = max(skill.last_updated for skill in market_skills)
    latest_window_end = max(skill.analysis_end_date for skill in market_skills)
    now = datetime.now(timezone.utc)
    market_age_days = (now - latest_updated.astimezone(timezone.utc)).days
    window_age_days = (now.date() - latest_window_end).days
    if max(market_age_days, window_age_days) > max_market_age_days:
        warnings.append(
            "Market statistics are stale "
            f"(window end {window_age_days} days ago, refreshed {market_age_days} days ago; "
            f"maximum age is {max_market_age_days} days)."
        )
    if total_weight <= 0:
        status = "insufficient_market_data"
    else:
        status = "estimated" if warnings else "ready"
    if total_weight <= 0:
        warnings.append("No market skill weights are available to calculate coverage.")
    return {
        "careerProfileId": career_profile_id,
        "marketWindow": {
            "startDate": min(skill.analysis_start_date for skill in market_skills).isoformat(),
            "endDate": max(skill.analysis_end_date for skill in market_skills).isoformat(),
        },
        "marketSample": {"totalJobs": total_jobs, "lastUpdated": _iso(latest_updated)},
        "status": status,
        "scores": scores,
        "skillSummary": counts,
        "coreSkillPolicy": {
            "version": "weighted-top-20-with-cutoff-ties-v1",
            "nominalLimit": CORE_SKILL_LIMIT,
            "includedCount": len(core_rows),
        },
        "skills": skill_results,
        "unmatchedUserSkills": unmatched_user_skills or [],
        "warnings": warnings,
    }


def _market_skill_body(skill: MarketSkill) -> dict[str, Any]:
    return {
        "skillId": skill.skill_id,
        "skillName": skill.skill_name,
        "marketTargetLevel": skill.target_level,
        "targetLevelConfidence": float(skill.target_level_confidence)
        if skill.target_level_confidence is not None else None,
        "levelObservationCount": skill.level_observation_count,
        "demandCount": skill.demand_count,
        "totalJobs": skill.total_jobs,
        "demandPercentage": float(skill.demand_percentage),
        "weightedDemandScore": float(skill.weighted_demand_score)
        if skill.weighted_demand_score is not None else None,
        "importanceTier": skill.importance_tier,
    }


def _evidence_body(evidence: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    """Return short evidence excerpts; never return the full profile or CV text."""
    return [
        {
            "type": item.get("type"),
            "excerpt": str(item.get("text") or "")[:320] or None,
            "confidence": float(item["confidence"]) if item.get("confidence") is not None else None,
        }
        for item in evidence[:3]
    ]


def _percent(value: Decimal) -> float:
    return round(float(value * 100), 2)


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


class CareerMatchRepository:
    """Read-only adapter joining a saved Resume profile to Market statistics."""

    def __init__(self, settings: CvSettings):
        self._settings = settings

    async def list_career_profiles(self) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_career_profiles)

    async def recommendations(
        self, profile_id: str, session_id: str, limit: int = 6
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._recommendations, profile_id, session_id, limit
        )

    def _recommendations(
        self, profile_id: str, session_id: str, limit: int
    ) -> dict[str, Any] | None:
        """Rank available market career profiles by confirmed skill overlap."""
        with self._connect() as connection:
            owner = connection.execute(
                """
                SELECT goals.target_role_title
                FROM app.user_profiles AS profiles
                JOIN app.users AS users USING (user_id)
                LEFT JOIN app.user_career_goals AS goals
                  ON goals.user_id = profiles.user_id AND goals.is_primary = true
                WHERE profiles.profile_id = %s
                  AND users.auth_provider = 'anonymous'
                  AND users.auth_subject = %s
                """,
                (profile_id, session_id),
            ).fetchone()
        if owner is None:
            return None
        target_role = owner[0]
        candidates = self._list_career_profiles()
        recommendations: list[dict[str, Any]] = []

        for candidate in candidates:
            result = self._calculate(
                profile_id, session_id, candidate["careerProfileId"]
            )
            if result is None:
                return None
            skills = result["skills"]
            covered = [skill for skill in skills if skill["status"] == "covered"]
            gaps = [
                skill for skill in skills
                if skill["status"] in {"missing_from_profile", "proficiency_gap", "not_assessed"}
            ]
            covered.sort(
                key=lambda skill: (
                    -(skill["weightedDemandScore"] or 0),
                    skill["skillName"].casefold(),
                )
            )
            gaps.sort(
                key=lambda skill: (
                    skill["priorityRank"] is None,
                    skill["priorityRank"] or 10_000,
                    -(skill["weightedDemandScore"] or 0),
                    skill["skillName"].casefold(),
                )
            )
            coverage = result["scores"]["marketSkillCoveragePct"]
            recommendations.append({
                **candidate,
                "id": str(candidate["careerProfileId"]),
                "title": candidate["profileName"],
                "scorePct": coverage,
                "marketStatus": result["status"],
                "totalJobs": result["marketSample"]["totalJobs"],
                "transferableSkills": [skill["skillName"] for skill in covered[:5]],
                "developmentAreas": [skill["skillName"] for skill in gaps[:5]],
                "whyExplore": (
                    f"Your confirmed profile skills cover {coverage:.1f}% of weighted skill demand "
                    f"in the {result['marketSample']['totalJobs']} posting market sample. "
                    "This compares skill labels and does not predict hiring outcomes."
                    if coverage is not None else
                    "Market skill coverage could not be calculated for this career profile."
                ),
                "supportedProfile": [
                    {
                        "skill": skill["skillName"],
                        "detail": (
                            f"Present in your confirmed profile; listed in "
                            f"{skill['demandPercentage']:.1f}% of the market sample."
                        ),
                    }
                    for skill in covered[:5]
                ],
                "skillsToDevelop": [
                    {
                        "skill": skill["skillName"],
                        "detail": (
                            f"Listed in {skill['demandPercentage']:.1f}% of the market sample. "
                            "Confirm your experience before treating this as a skill gap."
                        ),
                    }
                    for skill in gaps[:5]
                ],
            })

        recommendations.sort(
            key=lambda item: (
                item["scorePct"] is None,
                -(item["scorePct"] or 0),
                item["title"].casefold(),
                item["seniorityLevel"].casefold(),
            )
        )
        for index, item in enumerate(recommendations):
            item["iconTone"] = ("blue", "violet", "emerald")[index % 3]
            item["summary"] = (
                f"{item['totalJobs']} market postings · "
                f"{item['scorePct']:.1f}% weighted skill coverage"
                if item["scorePct"] is not None
                else f"{item['totalJobs']} market postings · coverage unavailable"
            )
        return {
            "targetRole": target_role,
            "recommendations": recommendations[:limit],
        }

    def _list_career_profiles(self) -> list[dict[str, Any]]:
        try:
            with self._connect() as connection:
                connection.execute("SET TRANSACTION READ ONLY")
                rows = connection.execute(
                    """
                    SELECT profiles.career_profile_id, careers.career_name,
                           profiles.profile_name, profiles.seniority_level
                    FROM core.career_profiles AS profiles
                    JOIN core.careers AS careers USING (career_id)
                    WHERE profiles.is_active = true
                      AND careers.is_active = true
                      AND EXISTS (
                          SELECT 1
                          FROM market.career_skill_stats AS stats
                          WHERE stats.career_profile_id = profiles.career_profile_id
                      )
                    ORDER BY careers.career_name, profiles.seniority_level,
                             profiles.profile_name, profiles.career_profile_id
                    """
                ).fetchall()
            return [
                {
                    "careerProfileId": row[0],
                    "careerName": row[1],
                    "profileName": row[2],
                    "seniorityLevel": row[3],
                }
                for row in rows
            ]
        except Exception as exc:  # noqa: BLE001 - don't expose database internals
            log.warning("career profile list lookup failed: %s", type(exc).__name__)
            raise AppError("CAREER_MATCH_UNAVAILABLE") from exc

    async def calculate(
        self, profile_id: str, session_id: str, career_profile_id: int
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._calculate, profile_id, session_id, career_profile_id
        )

    def _connect(self) -> psycopg.Connection[Any]:
        import psycopg

        return psycopg.connect(
            host=self._settings.DB_HOST,
            port=self._settings.DB_PORT,
            dbname=self._settings.DB_NAME,
            user=self._settings.DB_USER,
            password=self._settings.DB_PASSWORD,
            connect_timeout=5,
        )

    def _calculate(
        self, profile_id: str, session_id: str, career_profile_id: int
    ) -> dict[str, Any] | None:
        try:
            with self._connect() as connection:
                connection.execute("SET TRANSACTION READ ONLY")
                profile_row = connection.execute(
                    """
                    SELECT profiles.user_id
                    FROM app.user_profiles AS profiles
                    JOIN app.users AS users USING (user_id)
                    WHERE profiles.profile_id = %s
                      AND users.auth_provider = 'anonymous'
                      AND users.auth_subject = %s
                    """,
                    (profile_id, session_id),
                ).fetchone()
                if profile_row is None:
                    return None
                user_id = profile_row[0]
                user_rows = connection.execute(
                    """
                    SELECT skill_id, proficiency_level::text, proficiency_basis
                    FROM app.user_skills
                    WHERE user_id = %s
                      AND skill_id IS NOT NULL
                      AND match_status = 'matched'
                      AND user_confirmed = true
                    ORDER BY skill_id
                    """,
                    (user_id,),
                ).fetchall()
                evidence_rows = connection.execute(
                    """
                    SELECT skills.skill_id, evidence.evidence_type,
                           evidence.evidence_text, evidence.confidence
                    FROM app.user_skills AS skills
                    JOIN app.user_skill_evidence AS evidence
                      USING (user_skill_id)
                    WHERE skills.user_id = %s
                      AND skills.skill_id IS NOT NULL
                      AND skills.match_status = 'matched'
                      AND skills.user_confirmed = true
                    ORDER BY skills.skill_id, evidence.evidence_id
                    """,
                    (user_id,),
                ).fetchall()
                unmatched_rows = connection.execute(
                    """
                    SELECT raw_skill_name, match_status::text
                    FROM app.user_skills
                    WHERE user_id = %s
                      AND match_status <> 'matched'
                      AND user_confirmed = true
                    ORDER BY raw_skill_name
                    """,
                    (user_id,),
                ).fetchall()
                market_rows = connection.execute(
                    """
                    WITH latest_window AS (
                        SELECT analysis_start_date, analysis_end_date
                        FROM market.career_skill_stats
                        WHERE career_profile_id = %s
                        GROUP BY analysis_start_date, analysis_end_date
                        ORDER BY analysis_end_date DESC, analysis_start_date DESC
                        LIMIT 1
                    )
                    SELECT stats.skill_id, skills.skill_name, stats.demand_count,
                           stats.total_jobs, stats.demand_percentage,
                           stats.weighted_demand_score, stats.target_level,
                           stats.target_level_confidence,
                           stats.level_observation_count, stats.importance_tier,
                           stats.analysis_start_date, stats.analysis_end_date,
                           stats.last_updated
                    FROM market.career_skill_stats AS stats
                    JOIN latest_window AS latest
                      USING (analysis_start_date, analysis_end_date)
                    JOIN core.skills AS skills USING (skill_id)
                    WHERE stats.career_profile_id = %s
                    ORDER BY stats.weighted_demand_score DESC NULLS LAST, skills.skill_name
                    """,
                    (career_profile_id, career_profile_id),
                ).fetchall()

            evidence_by_skill: dict[int, list[dict[str, Any]]] = {}
            for skill_id, evidence_type, evidence_text, confidence in evidence_rows:
                evidence_by_skill.setdefault(skill_id, []).append({
                    "type": evidence_type,
                    "text": evidence_text,
                    "confidence": confidence,
                })
            users = [
                UserSkill(*row, tuple(evidence_by_skill.get(row[0], ())))
                for row in user_rows
            ]
            unmatched = [
                {"rawSkillName": raw_name, "matchStatus": match_status}
                for raw_name, match_status in unmatched_rows
            ]
            market = [MarketSkill(*row) for row in market_rows]
            return calculate_match(
                career_profile_id,
                users,
                market,
                unmatched_user_skills=unmatched,
                min_total_jobs=self._settings.MATCH_MIN_TOTAL_JOBS,
                max_market_age_days=self._settings.MATCH_MAX_MARKET_AGE_DAYS,
                min_level_observations=self._settings.MATCH_MIN_LEVEL_OBSERVATIONS,
                min_target_level_confidence=Decimal(
                    str(self._settings.MATCH_MIN_TARGET_LEVEL_CONFIDENCE)
                ),
            )
        except Exception as exc:  # noqa: BLE001 - don't expose database internals
            log.warning("career match lookup failed: %s", type(exc).__name__)
            raise AppError("CAREER_MATCH_UNAVAILABLE") from exc
