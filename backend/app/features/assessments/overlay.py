"""Apply kept assessment results to the learner's skill rows.

Saving a profile deletes and recreates ``app.user_skills`` from the profile JSON, so assessed
levels cannot live only in those rows. The latest accepted quiz per skill takes priority over
self-ratings; otherwise the latest accepted self-rating is used. This function writes it into
``app.user_skills`` (and one assessment evidence row). It runs after every profile save and after a learner keeps a result,
inside the caller's transaction.
"""

from __future__ import annotations

from typing import Any

CONFIDENCE = {"high": 0.9, "medium": 0.6, "low": 0.3}


def assessments_ready(connection: Any) -> bool:
    """False until migration 017 is applied, so profile saves keep working on older databases."""
    row = connection.execute("SELECT to_regclass('app.skill_assessments') IS NOT NULL").fetchone()
    return bool(row and row[0])


def apply_accepted_assessments(connection: Any, user_id: int, skill_id: int | None = None) -> int:
    """Write the strongest kept evidence per skill into app.user_skills. Returns rows written."""
    if not assessments_ready(connection):
        return 0
    rows = connection.execute(
        """
        SELECT DISTINCT ON (a.skill_id)
               a.skill_id, s.skill_name, a.result_level, a.method, a.confidence, a.kind, a.summary
        FROM app.skill_assessments AS a
        JOIN core.skills AS s USING (skill_id)
        WHERE a.user_id = %s AND a.decision = 'accepted' AND a.result_level IS NOT NULL
          AND a.kind IN ('level_check', 'quick_question')
          AND (%s::bigint IS NULL OR a.skill_id = %s::bigint)
        ORDER BY a.skill_id, (a.method = 'quiz') DESC, a.decided_at DESC, a.assessment_id DESC
        """,
        (user_id, skill_id, skill_id),
    ).fetchall()
    for skill, name, level, method, confidence, kind, summary in rows:
        basis = "assessed" if method == "quiz" else "self_reported"
        user_skill_id = connection.execute(
            """
            INSERT INTO app.user_skills (
                user_id, skill_id, raw_skill_name, normalized_skill_name, match_status,
                proficiency_level, proficiency_basis, source, confidence, verification_type, user_confirmed
            ) VALUES (%s, %s, %s, %s, 'matched', %s::app.proficiency_level, %s, 'assessment', %s, %s, true)
            ON CONFLICT (user_id, skill_id) DO UPDATE SET
                proficiency_level = EXCLUDED.proficiency_level,
                proficiency_basis = EXCLUDED.proficiency_basis,
                verification_type = EXCLUDED.verification_type,
                source = EXCLUDED.source,
                confidence = EXCLUDED.confidence,
                user_confirmed = true,
                updated_at = now()
            RETURNING user_skill_id
            """,
            (user_id, skill, name, name.lower(), level, basis, CONFIDENCE.get(confidence or "low", 0.3),
             f"{kind}:{method}"),
        ).fetchone()[0]
        connection.execute(
            "DELETE FROM app.user_skill_evidence WHERE user_skill_id = %s AND evidence_type = 'assessment'",
            (user_skill_id,),
        )
        connection.execute(
            """
            INSERT INTO app.user_skill_evidence (user_skill_id, evidence_type, evidence_text, confidence)
            VALUES (%s, 'assessment', %s, %s)
            """,
            (user_skill_id, _evidence_text(level, method, confidence, summary or {}),
             CONFIDENCE.get(confidence or "low", 0.3)),
        )
    return len(rows)


def _evidence_text(level: str, method: str, confidence: str | None, summary: dict) -> str:
    if method == "quiz":
        asked, correct = summary.get("asked"), summary.get("correct")
        detail = f", {correct} of {asked} questions correct" if asked else ""
        return f"Level check: {level} ({confidence} confidence{detail})."
    return f"Self-reported in a skill check: {level}."
