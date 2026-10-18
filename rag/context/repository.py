"""Read a single consistent input snapshot; never write user/catalog records."""

from typing import Any

from rag.context.models import (
    Background, CareerProfile, ConfirmedSkill, ContextInputs, DateBasis, Evidence,
    Goal, MarketInputs, MarketSkill, MarketWindow, UnresolvedSkill, UserInputs,
)


def _dicts(connection: Any, query: str, parameters: tuple) -> list[dict]:
    cursor = connection.execute(query, parameters)
    names = [column.name for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def load_inputs(
    connection: Any, *, career_profile_id: int, profile_id: str | None = None,
    date_basis: DateBasis = "posted_at",
) -> ContextInputs:
    """Use an idle connection whose caller already authorized access to the profile.

    This is not an HTTP authentication boundary. A Backend caller must enforce
    profile ownership before calling it. The CLI is for the local database owner.
    """
    if date_basis not in {"posted_at", "first_seen_at"}:
        raise ValueError("Unknown market analysis date basis")
    if connection.info.transaction_status != 0:
        raise ValueError("Input repository requires an idle connection")
    with connection.transaction():
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        careers = _dicts(connection, """
            SELECT p.career_id, p.career_profile_id, c.career_name,
                   p.profile_name, p.seniority_level
            FROM core.career_profiles p JOIN core.careers c USING (career_id)
            WHERE p.career_profile_id = %s AND p.is_active AND c.is_active
        """, (career_profile_id,))
        if not careers:
            raise ValueError("Active career profile not found")
        career = CareerProfile.model_validate(careers[0])
        windows = _dicts(connection, """
            SELECT DISTINCT analysis_start_date, analysis_end_date, analysis_date_basis
            FROM market.career_skill_stats
            WHERE career_profile_id = %s AND analysis_date_basis = %s
            ORDER BY analysis_end_date DESC, analysis_start_date DESC LIMIT 1
        """, (career_profile_id, date_basis))
        window = MarketWindow.model_validate(windows[0]) if windows else None
        skills = []
        if window:
            skills = _dicts(connection, """
                SELECT s.skill_id, s.skill_name, m.demand_count, m.total_jobs,
                       m.demand_percentage, m.required_count, m.preferred_count,
                       m.optional_count, m.weighted_demand_score, m.target_level,
                       m.target_level_confidence, m.level_observation_count,
                       m.importance_tier, m.last_updated
                FROM market.career_skill_stats m JOIN core.skills s USING (skill_id)
                WHERE m.career_profile_id = %s AND m.analysis_date_basis = %s
                  AND m.analysis_start_date = %s AND m.analysis_end_date = %s
                ORDER BY s.skill_id
            """, (career_profile_id, date_basis, window.analysis_start_date, window.analysis_end_date))
        market = MarketInputs(
            career_profile_id=career_profile_id, window=window,
            skills=tuple(MarketSkill.model_validate(row) for row in skills),
        )
        warnings = [] if skills else ["NO_MARKET_DATA_FOR_DATE_BASIS"]
        user = _load_user(connection, profile_id, career_profile_id) if profile_id else None
        if user and user.goal is None:
            warnings.append("NO_SAVED_GOAL_FOR_CAREER_PROFILE")
        if user and user.background.current_status == "other":
            warnings.append("OTHER_SITUATION_DETAIL_REQUIRES_BACKEND_SCHEMA_SUPPORT")
        if any(skill.target_level == "unknown" for skill in market.skills):
            warnings.append("SOME_MARKET_TARGET_LEVELS_UNKNOWN")
        return ContextInputs(
            career=career, market=market, user=user, warnings=tuple(warnings),
        )


def _load_user(connection: Any, profile_id: str, career_profile_id: int) -> UserInputs:
    profiles = _dicts(connection, """
        SELECT user_id, current_status::text, current_job_title, years_experience,
               education_level, field_of_study
        FROM app.user_profiles WHERE profile_id = %s
    """, (profile_id,))
    if not profiles:
        raise ValueError("Saved profile not found")
    profile = profiles[0]
    user_id = profile.pop("user_id")
    goals = _dicts(connection, """
        SELECT goal_id, career_id, career_profile_id, target_role_title,
               readiness_timeframe::text, target_date, weekly_availability::text,
               available_hours_per_week, preferred_learning_style::text,
               additional_context
        FROM app.user_career_goals
        WHERE user_id = %s AND career_profile_id = %s
        ORDER BY is_primary DESC, updated_at DESC, goal_id DESC LIMIT 1
    """, (user_id, career_profile_id))
    rows = _dicts(connection, """
        SELECT u.user_skill_id, u.skill_id, s.skill_name, u.raw_skill_name,
               u.proficiency_level::text, u.proficiency_basis, u.confidence,
               u.match_status::text
        FROM app.user_skills u LEFT JOIN core.skills s USING (skill_id)
        WHERE u.user_id = %s AND u.user_confirmed ORDER BY u.user_skill_id
    """, (user_id,))
    evidence_rows = _dicts(connection, """
        SELECT e.user_skill_id, e.evidence_type, left(e.evidence_text, 1000) AS excerpt,
               e.experience_id, e.confidence
        FROM app.user_skill_evidence e
        JOIN app.user_skills u USING (user_skill_id)
        WHERE u.user_id = %s AND u.user_confirmed ORDER BY e.evidence_id
    """, (user_id,))
    evidence: dict[int, list[Evidence]] = {}
    for row in evidence_rows:
        row_id = row.pop("user_skill_id")
        evidence.setdefault(row_id, []).append(Evidence.model_validate(row))
    confirmed, unresolved = [], []
    for row in rows:
        item_evidence = tuple(evidence.get(row["user_skill_id"], ()))
        if row["skill_id"] is not None and row["match_status"] == "matched":
            confirmed.append(ConfirmedSkill(
                **{key: row[key] for key in (
                    "skill_id", "skill_name", "raw_skill_name", "proficiency_level",
                    "proficiency_basis", "confidence",
                )}, evidence=item_evidence,
            ))
        elif row["skill_id"] is None and row["match_status"] in {"needs_review", "unmatched"}:
            unresolved.append(UnresolvedSkill(
                raw_skill_name=row["raw_skill_name"], match_status=row["match_status"],
                proficiency_level=row["proficiency_level"], evidence=item_evidence,
            ))
        else:
            raise ValueError("User skill has an inconsistent catalog match")
    return UserInputs(
        profile_id=profile_id, background=Background.model_validate(profile),
        goal=Goal.model_validate(goals[0]) if goals else None,
        confirmed_skills=tuple(confirmed), unresolved_skills=tuple(unresolved),
    )
