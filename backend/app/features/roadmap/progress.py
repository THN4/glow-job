"""Progress overview from persisted records, without synthesizing activity history."""

from datetime import datetime, timezone
from typing import Any


def progress_overview(connection: Any, user_id: int, career_profile_id: int | None) -> dict:
    params = {"user_id": user_id, "career_profile_id": career_profile_id}
    skills, evidence, analysed, profile_updated, goal_updated, market_updated = connection.execute(
        """
        SELECT
            (SELECT count(*) FROM app.user_skills WHERE user_id = %(user_id)s),
            (SELECT count(*) FROM app.user_skill_evidence e JOIN app.user_skills s USING (user_skill_id)
             WHERE s.user_id = %(user_id)s),
            (SELECT max(generated_at) FROM app.roadmaps WHERE user_id = %(user_id)s AND status = 'active'),
            (SELECT updated_at FROM app.user_profiles WHERE user_id = %(user_id)s),
            (SELECT max(updated_at) FROM app.user_career_goals WHERE user_id = %(user_id)s AND is_primary),
            (SELECT max(last_updated) FROM market.career_skill_stats
             WHERE career_profile_id = %(career_profile_id)s)
        """, params,
    ).fetchone()
    rows = connection.execute(
        """
        SELECT * FROM (
            SELECT 'goal-' || goal_id AS id, 'goal' AS kind,
                   CASE WHEN updated_at > created_at THEN 'Career goal updated' ELSE 'Career goal set' END AS title,
                   target_role_title AS description, NULL::text AS node_key,
                   updated_at AS occurred_at, NULL::bigint AS roadmap_id
            FROM app.user_career_goals WHERE user_id = %(user_id)s
            UNION ALL
            SELECT 'roadmap-' || roadmap_id, 'replan',
                   CASE WHEN version = 1 THEN 'Roadmap generated' ELSE 'Roadmap re-planned' END,
                   title, NULL, generated_at, roadmap_id
            FROM app.roadmaps WHERE user_id = %(user_id)s
            UNION ALL
            SELECT 'step-' || s.roadmap_step_id, 'completed', s.title || ' marked complete',
                   'Completed on your roadmap.', s.step_key, p.completed_at, s.roadmap_id
            FROM app.user_roadmap_progress p JOIN app.roadmap_steps s USING (roadmap_step_id)
            JOIN app.roadmaps r USING (roadmap_id)
            WHERE p.user_id = %(user_id)s AND r.user_id = %(user_id)s
              AND p.status = 'completed' AND p.completed_at IS NOT NULL
            UNION ALL
            SELECT 'task-' || t.task_id, 'completed', t.title || ' completed',
                   'Task completed in ' || s.title || '.', s.step_key, p.completed_at, s.roadmap_id
            FROM app.user_task_progress p JOIN app.roadmap_tasks t USING (task_id)
            JOIN app.roadmap_steps s USING (roadmap_step_id)
            JOIN app.roadmaps r USING (roadmap_id)
            WHERE p.user_id = %(user_id)s AND r.user_id = %(user_id)s
              AND p.status = 'completed' AND p.completed_at IS NOT NULL
            UNION ALL
            SELECT 'evidence-' || e.evidence_id, 'evidence',
                   'Evidence saved for ' || s.raw_skill_name,
                   coalesce(e.evidence_text, e.evidence_type), NULL, e.created_at, NULL
            FROM app.user_skill_evidence e JOIN app.user_skills s USING (user_skill_id)
            WHERE s.user_id = %(user_id)s
            UNION ALL
            SELECT 'assessment-' || a.assessment_id, 'assessment',
                   coalesce(s.skill_name, 'Roadmap step') || ' assessment completed',
                   CASE WHEN a.result_level IS NULL THEN 'Step check completed.'
                        ELSE 'Result: ' || a.result_level END,
                   a.step_key, a.completed_at, a.roadmap_id
            FROM app.skill_assessments a LEFT JOIN core.skills s USING (skill_id)
            WHERE a.user_id = %(user_id)s AND a.status = 'completed' AND a.completed_at IS NOT NULL
        ) events ORDER BY occurred_at DESC, id DESC LIMIT 12
        """, params,
    ).fetchall()
    return {
        "skillsInProfile": skills,
        "evidenceItems": evidence,
        "lastAnalysedAt": analysed.isoformat() if analysed else None,
        "profileChangedSinceAnalysis": bool(analysed and any(
            value and value > analysed for value in (profile_updated, goal_updated)
        )),
        "marketUpdatedAt": market_updated.isoformat() if market_updated else None,
        "marketScanAgeDays": max(0, (datetime.now(timezone.utc) - market_updated).days) if market_updated else None,
        "activities": [
            {"id": row[0], "kind": row[1], "title": row[2], "description": row[3],
             "nodeKey": row[4], "occurredAt": row[5].isoformat(), "roadmapId": row[6]}
            for row in rows
        ],
    }
