"""PostgreSQL access for career goals, roadmap versions, generation snapshots and progress.

Every method is synchronous and opens its own connection; the service runs them in a
worker thread. Callers pass a user ID only after ``owner`` has matched the profile to
the anonymous session.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from ai.roadmap.contracts import RoadmapView
from ai.roadmap.generate import GenerationResult
from ai.roadmap.view import apply_progress
from app.features.resume.config import CvSettings
from app.features.resume.errors import AppError
from rag.context.agent_models import AgentContext

log = logging.getLogger("roadmap")

GOAL_COLUMNS = """
    g.goal_id, g.career_id, g.career_profile_id, g.target_role_title,
    g.readiness_timeframe::text, g.target_date, g.weekly_availability::text,
    g.available_hours_per_week, g.preferred_learning_style::text,
    g.additional_context, g.updated_at
"""


def goal_body(row: tuple) -> dict[str, Any]:
    return {
        "goalId": row[0], "careerId": row[1], "careerProfileId": row[2], "targetRoleTitle": row[3],
        "readinessTimeframe": row[4], "targetDate": row[5].isoformat() if row[5] else None,
        "weeklyAvailability": row[6],
        "availableHoursPerWeek": float(row[7]) if row[7] is not None else None,
        "preferredLearningStyle": row[8], "additionalContext": row[9],
        "updatedAt": row[10].isoformat() if isinstance(row[10], datetime) else row[10],
    }


class RoadmapRepository:
    def __init__(self, settings: CvSettings):
        self._settings = settings

    def _connect(self) -> psycopg.Connection[Any]:
        return psycopg.connect(
            host=self._settings.DB_HOST, port=self._settings.DB_PORT, dbname=self._settings.DB_NAME,
            user=self._settings.DB_USER, password=self._settings.DB_PASSWORD, connect_timeout=5,
        )

    # ------------------------------------------------------------------ ownership and goals

    def owner(self, profile_id: str, session_id: str) -> int | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT p.user_id FROM app.user_profiles AS p JOIN app.users AS u USING (user_id)
                WHERE p.profile_id = %s AND u.auth_provider = 'anonymous' AND u.auth_subject = %s
                """,
                (profile_id, session_id),
            ).fetchone()
        return row[0] if row else None

    def get_goal(self, user_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT g.goal_id,
                       coalesce(g.career_id, exact_match.career_id) AS career_id,
                       coalesce(g.career_profile_id, exact_match.career_profile_id) AS career_profile_id,
                       g.target_role_title, g.readiness_timeframe::text, g.target_date,
                       g.weekly_availability::text, g.available_hours_per_week,
                       g.preferred_learning_style::text, g.additional_context, g.updated_at
                FROM app.user_career_goals AS g
                LEFT JOIN LATERAL (
                    SELECT min(candidate.career_id) AS career_id,
                           min(candidate.career_profile_id) AS career_profile_id
                    FROM (
                        SELECT p.career_id, p.career_profile_id
                        FROM core.career_profiles AS p
                        JOIN core.careers AS c USING (career_id)
                        WHERE p.is_active AND c.is_active
                          AND lower(btrim(p.profile_name)) = lower(btrim(g.target_role_title))
                    ) AS candidate
                    HAVING count(*) = 1
                ) AS exact_match ON g.career_profile_id IS NULL
                WHERE g.user_id = %s
                  AND coalesce(g.career_profile_id, exact_match.career_profile_id) IS NOT NULL
                ORDER BY g.is_primary DESC, g.updated_at DESC, g.goal_id DESC LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        return goal_body(row) if row else None

    def put_goal(self, user_id: int, goal: dict[str, Any]) -> dict[str, Any]:
        """Create or update the user's primary goal. Earlier roadmaps keep their own career IDs."""
        with self._connect() as connection, connection.transaction():
            career = connection.execute(
                """
                SELECT p.career_id, c.career_name FROM core.career_profiles AS p
                JOIN core.careers AS c USING (career_id)
                WHERE p.career_profile_id = %s AND p.is_active AND c.is_active
                """,
                (goal["career_profile_id"],),
            ).fetchone()
            if career is None:
                raise AppError("CAREER_PROFILE_NOT_FOUND")
            values = (
                goal.get("target_role_title") or career[1], career[0], goal["career_profile_id"],
                goal["readiness_timeframe"], goal.get("target_date"), goal["weekly_availability"],
                goal.get("available_hours_per_week"), goal["preferred_learning_style"],
                goal.get("additional_context"),
            )
            existing = connection.execute(
                """
                SELECT goal_id FROM app.user_career_goals WHERE user_id = %s
                ORDER BY is_primary DESC, updated_at DESC, goal_id DESC LIMIT 1 FOR UPDATE
                """,
                (user_id,),
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE app.user_career_goals SET
                        target_role_title = %s, career_id = %s, career_profile_id = %s,
                        readiness_timeframe = %s, target_date = %s, weekly_availability = %s,
                        available_hours_per_week = %s, preferred_learning_style = %s,
                        additional_context = %s, is_primary = true, updated_at = now()
                    WHERE goal_id = %s
                    """,
                    (*values, existing[0]),
                )
                goal_id = existing[0]
            else:
                goal_id = connection.execute(
                    """
                    INSERT INTO app.user_career_goals (
                        target_role_title, career_id, career_profile_id, readiness_timeframe,
                        target_date, weekly_availability, available_hours_per_week,
                        preferred_learning_style, additional_context, user_id, is_primary
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                    RETURNING goal_id
                    """,
                    (*values, user_id),
                ).fetchone()[0]
            row = connection.execute(
                f"SELECT {GOAL_COLUMNS} FROM app.user_career_goals AS g WHERE g.goal_id = %s", (goal_id,),
            ).fetchone()
        return goal_body(row)

    # ------------------------------------------------------------------ Agent Context

    def build_context(self, profile_id: str, career_profile_id: int,
                      date_basis: str) -> AgentContext:
        from rag.context.build import build_agent_context

        with self._connect() as connection:
            return build_agent_context(
                connection, profile_id=profile_id, career_profile_id=career_profile_id,
                date_basis=date_basis,
                min_total_jobs=self._settings.MATCH_MIN_TOTAL_JOBS,
                max_market_age_days=self._settings.MATCH_MAX_MARKET_AGE_DAYS,
                min_level_observations=self._settings.MATCH_MIN_LEVEL_OBSERVATIONS,
                min_target_level_confidence=self._settings.MATCH_MIN_TARGET_LEVEL_CONFIDENCE,
            )

    # ------------------------------------------------------------------ cost guards

    def reusable_roadmap(self, user_id: int, goal_id: int, input_sha256: str) -> int | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT r.roadmap_id FROM app.roadmaps AS r
                JOIN app.roadmap_generations AS g USING (roadmap_id)
                WHERE r.user_id = %s AND r.goal_id = %s AND r.status = 'active' AND g.input_sha256 = %s
                """,
                (user_id, goal_id, input_sha256),
            ).fetchone()
        return row[0] if row else None

    def usage(self, user_id: int) -> dict[str, float]:
        """Paid runs today (UTC) for this user and overall, and estimated spend this month."""
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    count(*) FILTER (WHERE user_id = %s AND started_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
                    count(*) FILTER (WHERE started_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
                    coalesce(sum(estimated_cost_usd) FILTER (
                        WHERE started_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0)
                FROM system.ai_runs
                WHERE operation_type = 'roadmap_generation' AND model_provider <> 'mock'
                """,
                (user_id,),
            ).fetchone()
        return {"user_today": row[0], "all_today": row[1], "month_cost_usd": float(row[2])}

    def start_run(self, user_id: int, provider: str, model_id: str) -> int:
        with self._connect() as connection:
            return connection.execute(
                """
                INSERT INTO system.ai_runs (user_id, operation_type, model_provider, model_name, status)
                VALUES (%s, 'roadmap_generation', %s, %s, 'running') RETURNING ai_run_id
                """,
                (user_id, provider, model_id),
            ).fetchone()[0]

    def finish_run(self, ai_run_id: int, *, status: str, usage: dict[str, int], cost_usd: float,
                   error: str | None = None, metadata: dict[str, Any] | None = None) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE system.ai_runs SET
                    status = %s, finished_at = now(), error_message = %s,
                    input_tokens = %s, output_tokens = %s,
                    cache_read_input_tokens = %s, cache_creation_input_tokens = %s,
                    estimated_cost_usd = %s, metadata = %s
                WHERE ai_run_id = %s
                """,
                (status, error, usage.get("input_tokens", 0), usage.get("output_tokens", 0),
                 usage.get("cache_read_input_tokens", 0), usage.get("cache_creation_input_tokens", 0),
                 Decimal(str(cost_usd)), Jsonb(metadata or {}), ai_run_id),
            )

    # ------------------------------------------------------------------ roadmap versions

    def save(self, user_id: int, goal: dict[str, Any], context: AgentContext, result: GenerationResult,
             ai_run_id: int | None, reason: str) -> int:
        """Store a new active version, replace the previous one, and keep the inputs used."""
        view = result.view
        steps = {step.key: step for step in result.draft.steps}
        with self._connect() as connection, connection.transaction():
            connection.execute("SELECT 1 FROM app.user_career_goals WHERE goal_id = %s FOR UPDATE",
                               (goal["goalId"],))
            version, previous = connection.execute(
                """
                SELECT coalesce(max(version), 0) + 1,
                       (SELECT roadmap_id FROM app.roadmaps WHERE goal_id = %s AND status = 'active'
                        ORDER BY version DESC LIMIT 1)
                FROM app.roadmaps WHERE goal_id = %s
                """,
                (goal["goalId"], goal["goalId"]),
            ).fetchone()
            connection.execute(
                "UPDATE app.roadmaps SET status = 'replaced', updated_at = now() "
                "WHERE goal_id = %s AND status = 'active'",
                (goal["goalId"],),
            )
            roadmap_id = connection.execute(
                """
                INSERT INTO app.roadmaps (user_id, goal_id, career_id, career_profile_id, version, title,
                                          status, generation_reason, previous_roadmap_id)
                VALUES (%s, %s, %s, %s, %s, %s, 'active', %s, %s) RETURNING roadmap_id
                """,
                (user_id, goal["goalId"], goal["careerId"], goal["careerProfileId"], version,
                 view.summary.title, reason, previous),
            ).fetchone()[0]
            number = 0
            for node in view.nodes:
                if node.kind == "goal":
                    continue
                number += 1
                step = steps[node.key]
                persisted_kind = "skill" if step.kind == "completed_skill" else step.kind
                step_id = connection.execute(
                    """
                    INSERT INTO app.roadmap_steps (
                        roadmap_id, step_number, skill_id, title, description, current_level,
                        target_level, reason, estimated_hours, estimated_hours_min, estimated_hours_max,
                        is_required, step_key, step_kind, why, depends_on, citations
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s, %s, %s, %s, %s)
                    RETURNING roadmap_step_id
                    """,
                    (roadmap_id, number, node.skill.skill_id if node.skill else None, node.title, node.summary,
                     _level(node.skill.current_level if node.skill else None),
                     _level(node.skill.target_level if node.skill else None),
                     "; ".join(node.why_it_matters) or None, step.hours_max, step.hours_min, step.hours_max,
                     node.key, persisted_kind, Jsonb(node.why_it_matters), Jsonb(node.depends_on),
                     Jsonb([c.model_dump(by_alias=True) for c in node.citations])),
                ).fetchone()[0]
                for task_number, item in enumerate(node.checklist, 1):
                    connection.execute(
                        """
                        INSERT INTO app.roadmap_tasks (roadmap_step_id, task_number, title, description,
                                                       is_required, task_kind, citations)
                        VALUES (%s, %s, %s, %s, true, %s, %s)
                        """,
                        (step_id, task_number, item.label, item.detail, item.task_kind,
                         Jsonb([c.model_dump(by_alias=True) for c in item.citations])),
                    )
            connection.execute(
                """
                INSERT INTO app.roadmap_generations (
                    roadmap_id, user_id, goal_id, ai_run_id, input_sha256, context_id, prompt_version,
                    model_provider, model_id, agent_context, draft, view, validation_warnings, usage,
                    estimated_cost_usd
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (roadmap_id, user_id, goal["goalId"], ai_run_id, result.input_sha256, context.context_id,
                 view.generation.prompt_version, view.generation.provider, view.generation.model,
                 Jsonb(context.model_dump(mode="json")), Jsonb(result.draft.model_dump(mode="json")),
                 Jsonb(view.model_dump(mode="json", by_alias=True)), Jsonb(result.warnings),
                 Jsonb(result.usage.as_dict()), Decimal(str(result.cost_usd))),
            )
        return roadmap_id

    def current(self, user_id: int) -> RoadmapView | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT r.roadmap_id, r.version, r.status::text, g.view
                FROM app.roadmaps AS r JOIN app.roadmap_generations AS g USING (roadmap_id)
                WHERE r.user_id = %s AND r.status IN ('active', 'completed')
                ORDER BY r.generated_at DESC, r.roadmap_id DESC LIMIT 1
                """,
                (user_id,),
            ).fetchone()
            if row is None:
                return None
            done = connection.execute(
                """
                SELECT s.step_key || '.' || t.task_number
                FROM app.user_task_progress AS p
                JOIN app.roadmap_tasks AS t USING (task_id)
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                WHERE p.user_id = %s AND s.roadmap_id = %s AND p.status = 'completed'
                """,
                (user_id, row[0]),
            ).fetchall()
            marked = connection.execute(
                """
                SELECT s.step_key, p.status::text FROM app.user_roadmap_progress AS p
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                WHERE p.user_id = %s AND s.roadmap_id = %s AND p.status IN ('skipped', 'in_progress')
                """,
                (user_id, row[0]),
            ).fetchall()
        view = RoadmapView.model_validate(row[3]).model_copy(
            update={"roadmap_id": row[0], "version": row[1], "status": row[2]})
        return apply_progress(
            view, completed_tasks={r[0] for r in done},
            skipped_steps={key for key, status in marked if status == "skipped"},
            started_steps={key for key, status in marked if status == "in_progress"},
            today=datetime.now(timezone.utc).date())

    def set_task(self, user_id: int, roadmap_id: int, item_id: str, completed: bool) -> bool:
        step_key, _, number = item_id.rpartition(".")
        if not step_key or not number.isdigit():
            return False
        with self._connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT t.task_id, s.roadmap_step_id FROM app.roadmap_tasks AS t
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                JOIN app.roadmaps AS r USING (roadmap_id)
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s AND t.task_number = %s
                """,
                (roadmap_id, user_id, step_key, int(number)),
            ).fetchone()
            if row is None:
                return False
            task_id, step_id = row
            connection.execute(
                """
                INSERT INTO app.user_task_progress (user_id, task_id, status, completed_at, updated_at)
                VALUES (%s, %s, %s, CASE WHEN %s::boolean THEN now() END, now())
                ON CONFLICT (user_id, task_id) DO UPDATE SET
                    status = EXCLUDED.status, completed_at = EXCLUDED.completed_at, updated_at = now()
                """,
                (user_id, task_id, "completed" if completed else "not_started", completed),
            )
            total, finished = connection.execute(
                """
                SELECT count(*), count(*) FILTER (WHERE p.status = 'completed')
                FROM app.roadmap_tasks AS t
                LEFT JOIN app.user_task_progress AS p ON p.task_id = t.task_id AND p.user_id = %s
                WHERE t.roadmap_step_id = %s
                """,
                (user_id, step_id),
            ).fetchone()
            status = "completed" if total and finished == total else "in_progress" if finished else "not_started"
            connection.execute(
                """
                INSERT INTO app.user_roadmap_progress (user_id, roadmap_step_id, status, progress_percentage,
                                                       started_at, completed_at, updated_at)
                VALUES (%s, %s, %s, %s, CASE WHEN %s::int > 0 THEN now() END,
                        CASE WHEN %s::text = 'completed' THEN now() END, now())
                ON CONFLICT (user_id, roadmap_step_id) DO UPDATE SET
                    status = CASE WHEN EXCLUDED.status = 'not_started'
                                       AND app.user_roadmap_progress.started_at IS NOT NULL
                                  THEN 'in_progress'::app.progress_status ELSE EXCLUDED.status END,
                    progress_percentage = EXCLUDED.progress_percentage,
                    started_at = coalesce(app.user_roadmap_progress.started_at, EXCLUDED.started_at),
                    completed_at = EXCLUDED.completed_at, updated_at = now()
                """,
                (user_id, step_id, status, round(100 * finished / total, 2) if total else 0, finished, status),
            )
        return True


    def set_step(self, user_id: int, roadmap_id: int, step_key: str, status: str) -> bool:
        """Set a whole step: completed ticks every task, not_started clears them, in_progress and
        skipped only mark the step."""
        with self._connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT s.roadmap_step_id FROM app.roadmap_steps AS s
                JOIN app.roadmaps AS r USING (roadmap_id)
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s
                """,
                (roadmap_id, user_id, step_key),
            ).fetchone()
            if row is None:
                return False
            step_id = row[0]
            if status in {"completed", "not_started"}:
                done = status == "completed"
                connection.execute(
                    """
                    INSERT INTO app.user_task_progress (user_id, task_id, status, completed_at, updated_at)
                    SELECT %s, t.task_id, %s::app.progress_status, CASE WHEN %s::boolean THEN now() END, now()
                    FROM app.roadmap_tasks AS t WHERE t.roadmap_step_id = %s
                    ON CONFLICT (user_id, task_id) DO UPDATE SET
                        status = EXCLUDED.status, completed_at = EXCLUDED.completed_at, updated_at = now()
                    """,
                    (user_id, status, done, step_id),
                )
            connection.execute(
                """
                INSERT INTO app.user_roadmap_progress (user_id, roadmap_step_id, status, progress_percentage,
                                                       started_at, completed_at, updated_at)
                VALUES (%s, %s, %s::app.progress_status, %s,
                        CASE WHEN %s <> 'not_started' THEN now() END,
                        CASE WHEN %s = 'completed' THEN now() END, now())
                ON CONFLICT (user_id, roadmap_step_id) DO UPDATE SET
                    status = EXCLUDED.status, progress_percentage = EXCLUDED.progress_percentage,
                    started_at = CASE WHEN EXCLUDED.status = 'not_started' THEN NULL
                                      ELSE coalesce(app.user_roadmap_progress.started_at, EXCLUDED.started_at) END,
                    completed_at = EXCLUDED.completed_at, updated_at = now()
                """,
                (user_id, step_id, status, 100 if status == "completed" else 0, status, status),
            )
        return True


def _level(value: str | None) -> str | None:
    return value if value in {"beginner", "intermediate", "advanced", "expert", "unknown"} else None


def parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None
