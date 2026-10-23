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
from rag.context.agent_models import AgentContext, ReplanTrigger

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

    def progress_overview(self, user_id: int) -> dict[str, Any]:
        from app.features.roadmap.progress import progress_overview

        goal = self.get_goal(user_id)
        with self._connect() as connection:
            return progress_overview(connection, user_id, goal["careerProfileId"] if goal else None)

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

    def list_skill_artifacts(self, user_id: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT artifact_id, skill_id, evidence_type, title, source_url, notes, photo_data, created_at
                FROM app.user_skill_artifacts
                WHERE user_id = %s
                ORDER BY created_at DESC, artifact_id DESC
                """,
                (user_id,),
            ).fetchall()
        return [_artifact_body(row) for row in rows]

    def create_skill_artifact(self, user_id: int, skill_id: int, values: dict[str, Any]) -> dict[str, Any] | None:
        with self._connect() as connection, connection.transaction():
            row = connection.execute(
                """
                INSERT INTO app.user_skill_artifacts (
                    user_id, skill_id, evidence_type, title, source_url, notes, photo_data
                )
                SELECT %s, s.skill_id, %s, %s, %s, %s, %s
                FROM core.skills AS s WHERE s.skill_id = %s
                RETURNING artifact_id, skill_id, evidence_type, title, source_url, notes, photo_data, created_at
                """,
                (user_id, values["evidence_type"], values["title"], values["url"],
                 values["notes"], values["photo_data"], skill_id),
            ).fetchone()
        return _artifact_body(row) if row else None

    def delete_skill_artifact(self, user_id: int, artifact_id: int) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "DELETE FROM app.user_skill_artifacts WHERE artifact_id = %s AND user_id = %s RETURNING artifact_id",
                (artifact_id, user_id),
            ).fetchone()
        return row is not None

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

    # ------------------------------------------------------------------ rejection replan

    def rejection_options(self, user_id: int, profile_id: str, goal: dict[str, Any],
                          application_id: int, date_basis: str) -> dict[str, Any]:
        """Prefer skills explicitly named in feedback, including completed skills."""
        from app.features.roadmap.feedback_skills import mentioned_skill_ids
        from rag.context.assemble import score_market
        from rag.context.repository import load_inputs
        from src.documents.retrieval.skill_context import coverage

        with self._connect() as connection:
            inputs = load_inputs(connection, career_profile_id=goal["careerProfileId"],
                                 profile_id=profile_id, date_basis=date_basis)
            row = connection.execute(
                """
                SELECT a.job_title, COALESCE(a.company_name, c.company_name),
                       a.status::text, a.rejection_category, a.rejection_reason,
                       a.job_id, j.career_profile_id
                FROM app.job_applications a
                LEFT JOIN market.job_postings j USING (job_id)
                LEFT JOIN core.companies c ON c.company_id = COALESCE(a.company_id, j.company_id)
                WHERE a.user_id = %s AND a.application_id = %s
                """, (user_id, application_id),
            ).fetchone()
            if row is None:
                raise AppError("NOT_FOUND", "The saved application was not found.")
            title, company, status, category, reason, job_id, job_career_profile_id = row
            if status != "rejected" or category != "skill-gap":
                raise AppError("REPLAN_NOT_ELIGIBLE", "Record a skill-gap rejection before considering a replan.")
            if job_career_profile_id is not None and job_career_profile_id != goal["careerProfileId"]:
                raise AppError("REPLAN_NOT_ELIGIBLE", "This posting belongs to a different career goal.")
            requirements = {}
            if job_id is not None:
                requirement_rows = connection.execute(
                    """SELECT skill_id, requirement_type::text FROM market.job_skills
                       WHERE job_id = %s AND requirement_type IN ('required', 'preferred')""",
                    (job_id,),
                ).fetchall()
                for skill_id, requirement_type in requirement_rows:
                    if skill_id not in requirements or requirement_type == "required":
                        requirements[skill_id] = requirement_type
            plan_rows = connection.execute(
                """SELECT s.skill_id, p.status::text FROM app.roadmap_steps s
                   JOIN app.roadmaps r USING (roadmap_id)
                   LEFT JOIN app.user_roadmap_progress p
                     ON p.roadmap_step_id = s.roadmap_step_id AND p.user_id = r.user_id
                   WHERE r.user_id = %s AND r.goal_id = %s AND r.status = 'active'
                     AND s.skill_id IS NOT NULL""", (user_id, goal["goalId"]),
            ).fetchall()
            planned = {skill_id for skill_id, _ in plan_rows}
            completed = {row[0] for row in connection.execute(
                """SELECT DISTINCT s.skill_id FROM app.roadmap_steps s
                   JOIN app.roadmaps r USING (roadmap_id)
                   JOIN app.user_roadmap_progress p
                     ON p.roadmap_step_id = s.roadmap_step_id AND p.user_id = r.user_id
                   WHERE r.user_id = %s AND r.goal_id = %s AND p.status = 'completed'
                     AND s.skill_id IS NOT NULL""", (user_id, goal["goalId"]),
            ).fetchall()}
            spellings = connection.execute(
                """SELECT s.skill_id, s.skill_name FROM core.skills s
                   UNION ALL SELECT a.skill_id, a.alias FROM core.skill_aliases a""",
            ).fetchall()
            connection.commit()
            assessments, _ = score_market(
                inputs, inputs.user.confirmed_skills,
                min_total_jobs=self._settings.MATCH_MIN_TOTAL_JOBS,
                max_market_age_days=self._settings.MATCH_MAX_MARKET_AGE_DAYS,
                min_level_observations=self._settings.MATCH_MIN_LEVEL_OBSERVATIONS,
                min_target_level_confidence=self._settings.MATCH_MIN_TARGET_LEVEL_CONFIDENCE,
            )
            confirmed_ids = {item.skill_id for item in inputs.user.confirmed_skills}
            eligible = {item.market.skill_id: item for item in assessments
                        if item.gap.status in {"missing_from_profile", "proficiency_gap"}
                        or (item.market.skill_id in confirmed_ids
                            and item.gap.status in {"covered", "not_assessed"})}
            detected = mentioned_skill_ids(reason or "", spellings)
            mentions = [skill_id for skill_id in detected
                        if skill_id in eligible]
            if detected:
                choices = [eligible[skill_id] for skill_id in mentions]
                matching_mode = "feedback_mentions"
            elif (reason or "").strip():
                choices = []
                matching_mode = "no_mentions"
            else:
                choices = [item for item in assessments if item.priority_rank is not None
                           and item.gap.status in {"missing_from_profile", "proficiency_gap"}]
                if job_id is not None:
                    choices = [item for item in choices if item.market.skill_id in requirements]
                choices.sort(key=lambda item: (0 if requirements.get(item.market.skill_id) == "required" else 1,
                                               item.priority_rank))
                choices = choices[:12]
                matching_mode = "market_gaps"
            available = coverage(connection, [item.market.skill_id for item in choices]) if choices else {}

        return {
            "applicationId": application_id, "role": title, "company": company or "Company not specified",
            "rejectionCategory": category, "rejectionReason": reason or "",
            "reasonSource": "user_reported", "goalCareerProfileId": goal["careerProfileId"],
            "matchingMode": matching_mode,
            "options": [{
                "skillId": item.market.skill_id, "name": item.market.skill_name,
                "gapStatus": item.gap.status, "priorityRank": item.priority_rank,
                "requirementType": requirements.get(item.market.skill_id),
                "source": "feedback_mention" if matching_mode == "feedback_mentions"
                          else "job_requirement" if item.market.skill_id in requirements else "career_market",
                "alreadyPlanned": item.market.skill_id in planned,
                "completedInRoadmap": item.market.skill_id in completed,
                "inProfile": item.market.skill_id in confirmed_ids,
                "alreadyCompleted": (item.market.skill_id in completed
                                     or item.market.skill_id in confirmed_ids
                                     and item.gap.status in {"covered", "not_assessed"}),
                "learningContentAvailable": bool(available.get(item.market.skill_id, {}).get("embedded_chunks")),
            } for item in choices],
        }

    def market_replan_options(self, user_id: int, profile_id: str, goal: dict[str, Any],
                              date_basis: str) -> dict[str, Any]:
        """Offer unplanned skills from the active Agent Context's market snapshot.

        This is a demo story based on saved market frequencies, not a claim that
        demand increased over time. Content availability is informational only: a
        selected skill may still be added as a placeholder node when its evidence
        is not ready.
        """
        from src.documents.retrieval.skill_context import coverage

        saved = self.current_agent_context(user_id)
        if saved is None:
            return {"careerProfileId": goal["careerProfileId"], "careerName": goal["targetRoleTitle"],
                    "isDemo": True, "notice": "Demo alert based on the saved market snapshot.",
                    "marketWindow": None, "options": []}
        roadmap_id, context = saved
        with self._connect() as connection:
            planned = {row[0] for row in connection.execute(
                """SELECT DISTINCT s.skill_id FROM app.roadmap_steps s
                   JOIN app.roadmaps r USING (roadmap_id)
                   WHERE r.user_id = %s AND r.goal_id = %s AND r.status = 'active'
                     AND s.skill_id IS NOT NULL""", (user_id, goal["goalId"]),
            ).fetchall()}
            # coverage() opens its own repeatable-read transaction and requires
            # the connection to be idle; finish this SELECT transaction first.
            connection.commit()
            assessments = context.market_skill_assessments
            choices = [item for item in assessments if item.market.skill_id not in planned]
            choices.sort(key=lambda item: (
                0 if item.priority_rank is not None else 1,
                item.priority_rank or 10_000,
                -item.market.demand_percentage,
                item.market.skill_name.casefold(),
            ))
            available = coverage(connection, [item.market.skill_id for item in choices]) if choices else {}
        window = context.career_context.market_window

        options = [{
            "skillId": item.market.skill_id,
            "name": item.market.skill_name,
            "gapStatus": item.gap.status,
            "priorityRank": item.priority_rank,
            "importanceTier": item.market.importance_tier,
            "demandCount": item.market.demand_count,
            "totalJobs": item.market.total_jobs,
            "demandPercentage": item.market.demand_percentage,
            "learningContentAvailable": bool(available.get(item.market.skill_id, {}).get("embedded_chunks")),
            "alreadyInAgentContext": any(candidate.skill_id == item.market.skill_id
                                          for candidate in context.roadmap_candidates),
            "alertDetail": (
                f"Demo story: {item.market.skill_name} is showing up in "
                f"{item.market.demand_count} of {item.market.total_jobs} postings for "
                f"{context.career_context.profile_name}. It may be worth building into "
                "your skills. Would you like to add it to your next roadmap version?"
            ),
        } for item in choices[:20]]
        return {
            "careerProfileId": context.career_context.career_profile_id,
            "careerName": context.career_context.profile_name,
            "isDemo": True,
            "notice": "Demo alert: this is a sample story based on the saved market snapshot, not a measured increase in demand.",
            "baseRoadmapId": roadmap_id,
            "marketWindow": ({
                "analysisStartDate": window.analysis_start_date.isoformat(),
                "analysisEndDate": window.analysis_end_date.isoformat(),
                "analysisDateBasis": window.analysis_date_basis,
            } if window else None),
            "options": options,
        }

    # ------------------------------------------------------------------ Agent Context

    def current_agent_context(self, user_id: int) -> tuple[int, AgentContext] | None:
        """Load the context snapshot that produced the active roadmap, if any."""
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT r.roadmap_id, g.agent_context
                FROM app.roadmaps AS r
                JOIN app.roadmap_generations AS g USING (roadmap_id)
                WHERE r.user_id = %s AND r.status = 'active'
                ORDER BY r.version DESC, r.roadmap_id DESC
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return row[0], AgentContext.model_validate(row[1])

    def build_context(self, profile_id: str, career_profile_id: int,
                      date_basis: str, replan_trigger: ReplanTrigger | None = None) -> AgentContext:
        from rag.context.build import build_agent_context

        with self._connect() as connection:
            return build_agent_context(
                connection, profile_id=profile_id, career_profile_id=career_profile_id,
                date_basis=date_basis,
                min_total_jobs=self._settings.MATCH_MIN_TOTAL_JOBS,
                max_market_age_days=self._settings.MATCH_MAX_MARKET_AGE_DAYS,
                min_level_observations=self._settings.MATCH_MIN_LEVEL_OBSERVATIONS,
                min_target_level_confidence=self._settings.MATCH_MIN_TARGET_LEVEL_CONFIDENCE,
                replan_trigger=replan_trigger,
            )

    def extend_agent_context(self, previous: AgentContext, *, profile_id: str,
                             career_profile_id: int, date_basis: str,
                             replan_trigger: ReplanTrigger) -> AgentContext:
        """Append only selected-skill knowledge to the saved Agent Context snapshot."""
        from rag.context.build import extend_agent_context

        with self._connect() as connection:
            return extend_agent_context(
                connection, previous, profile_id=profile_id,
                career_profile_id=career_profile_id, date_basis=date_basis,
                replan_trigger=replan_trigger,
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
            previous_skill_progress: dict[int, dict[str, Any]] = {}
            focus_ids = set(context.replan_trigger.focus_skill_ids) if context.replan_trigger else set()
            if previous is not None and reason in {"application_rejection", "market_update"}:
                rows = connection.execute(
                    """
                    SELECT s.skill_id, s.target_level::text, sp.status::text,
                           t.title, t.description, t.task_kind, tp.completed_at
                    FROM app.roadmap_steps s
                    LEFT JOIN app.user_roadmap_progress sp
                      ON sp.roadmap_step_id = s.roadmap_step_id AND sp.user_id = %s
                    LEFT JOIN app.roadmap_tasks t
                      ON t.roadmap_step_id = s.roadmap_step_id
                    LEFT JOIN app.user_task_progress tp
                      ON tp.task_id = t.task_id AND tp.user_id = %s AND tp.status = 'completed'
                    WHERE s.roadmap_id = %s AND s.step_kind = 'skill' AND s.skill_id IS NOT NULL
                    """, (user_id, user_id, previous),
                ).fetchall()
                for skill_id, target_level, step_status, title, description, task_kind, completed_at in rows:
                    saved = previous_skill_progress.setdefault(skill_id, {
                        "target_level": target_level, "status": step_status, "tasks": {},
                    })
                    if title is not None and completed_at is not None:
                        saved["tasks"][(title, description, task_kind)] = completed_at
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
                    task_id = connection.execute(
                        """
                        INSERT INTO app.roadmap_tasks (roadmap_step_id, task_number, title, description,
                                                       is_required, task_kind, citations)
                        VALUES (%s, %s, %s, %s, true, %s, %s)
                        RETURNING task_id
                        """,
                        (step_id, task_number, item.label, item.detail, item.task_kind,
                         Jsonb([c.model_dump(by_alias=True) for c in item.citations])),
                    ).fetchone()[0]
                    previous_progress = (previous_skill_progress.get(node.skill.skill_id)
                                         if step.kind == "skill" and node.skill
                                         and node.skill.skill_id not in focus_ids else None)
                    if (previous_progress and previous_progress["target_level"] == _level(node.skill.target_level)
                            and (item.label, item.detail, item.task_kind) in previous_progress["tasks"]):
                        connection.execute(
                            """INSERT INTO app.user_task_progress
                               (user_id, task_id, status, completed_at, updated_at)
                               VALUES (%s, %s, 'completed', %s, now())""",
                            (user_id, task_id, previous_progress["tasks"][(item.label, item.detail, item.task_kind)]),
                        )
                previous_progress = (previous_skill_progress.get(node.skill.skill_id)
                                     if step.kind == "skill" and node.skill
                                     and node.skill.skill_id not in focus_ids else None)
                if previous_progress and previous_progress["target_level"] == _level(node.skill.target_level):
                    carried = sum((item.label, item.detail, item.task_kind) in previous_progress["tasks"]
                                  for item in node.checklist)
                    if carried:
                        status = ("completed" if carried == len(node.checklist)
                                  and previous_progress["status"] == "completed" else "in_progress")
                        connection.execute(
                            """INSERT INTO app.user_roadmap_progress
                               (user_id, roadmap_step_id, status, progress_percentage,
                                started_at, completed_at, updated_at)
                               VALUES (%s, %s, %s::app.progress_status, %s, now(),
                                       CASE WHEN %s = 'completed' THEN now() END, now())""",
                            (user_id, step_id, status, round(100 * carried / len(node.checklist), 2), status),
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

    def history(self, user_id: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT r.roadmap_id, r.version, r.status::text, r.generation_reason,
                          r.previous_roadmap_id, r.generated_at,
                          g.agent_context->'replan_trigger'
                   FROM app.roadmaps r
                   JOIN app.roadmap_generations g USING (roadmap_id)
                   WHERE r.user_id = %s
                   ORDER BY r.version DESC, r.roadmap_id DESC""", (user_id,),
            ).fetchall()
        return [{"roadmapId": row[0], "version": row[1], "status": row[2],
                 "generationReason": row[3], "previousRoadmapId": row[4],
                 "generatedAt": row[5].isoformat(), "replanTrigger": row[6]}
                for row in rows]

    def current(self, user_id: int, roadmap_id: int | None = None) -> RoadmapView | None:
        with self._connect() as connection:
            query = """
                SELECT r.roadmap_id, r.version, r.status::text, g.view,
                       g.agent_context->'foundation_mentions'
                FROM app.roadmaps AS r JOIN app.roadmap_generations AS g USING (roadmap_id)
                WHERE r.user_id = %s
            """
            if roadmap_id is None:
                query += " AND r.status IN ('active', 'completed') ORDER BY r.generated_at DESC, r.roadmap_id DESC LIMIT 1"
                params = (user_id,)
            else:
                query += " AND r.roadmap_id = %s"
                params = (user_id, roadmap_id)
            row = connection.execute(query, params).fetchone()
            if row is None:
                return None
            tasks = connection.execute(
                """
                SELECT s.step_key || '.' || t.task_number, p.status = 'completed',
                       p.verified_by_assessment_id IS NOT NULL, p.needs_review
                FROM app.user_task_progress AS p
                JOIN app.roadmap_tasks AS t USING (task_id)
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                WHERE p.user_id = %s AND s.roadmap_id = %s
                """,
                (user_id, row[0]),
            ).fetchall()
            done = [(r[0],) for r in tasks if r[1]]
            counts = dict(connection.execute(
                "SELECT chunk_id, count(*) FROM app.assessment_items WHERE status IN ('approved', 'provisional') "
                "GROUP BY chunk_id"
            ).fetchall())
            marked = connection.execute(
                """
                SELECT s.step_key, p.status::text FROM app.user_roadmap_progress AS p
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                WHERE p.user_id = %s AND s.roadmap_id = %s
                  AND p.status IN ('skipped', 'in_progress', 'completed')
                """,
                (user_id, row[0]),
            ).fetchall()
        from ai.roadmap.dependencies import remove_unsupported_view_dependencies, required_skill_pairs

        view = RoadmapView.model_validate(row[3]).model_copy(
            update={"roadmap_id": row[0], "version": row[1], "status": row[2]})
        view = remove_unsupported_view_dependencies(
            view, required_skill_pairs(row[4] or []))
        return apply_progress(
            view, completed_tasks={r[0] for r in done},
            skipped_steps={key for key, status in marked if status == "skipped"},
            started_steps={key for key, status in marked if status == "in_progress"},
            confirmed_steps={key for key, status in marked if status == "completed"},
            today=datetime.now(timezone.utc).date(),
            verified_tasks={r[0] for r in tasks if r[1] and r[2]},
            review_tasks={r[0] for r in tasks if r[3] and not r[1]},
            question_counts=counts)

    def set_task(self, user_id: int, roadmap_id: int, item_id: str, completed: bool) -> bool:
        step_key, _, number = item_id.rpartition(".")
        if not step_key or not number.isdigit():
            return False
        with self._connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT t.task_id, s.roadmap_step_id, p.status::text FROM app.roadmap_tasks AS t
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                JOIN app.roadmaps AS r USING (roadmap_id)
                LEFT JOIN app.user_roadmap_progress AS p
                  ON p.roadmap_step_id = s.roadmap_step_id AND p.user_id = r.user_id
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s AND t.task_number = %s
                  AND r.status = 'active'
                """,
                (roadmap_id, user_id, step_key, int(number)),
            ).fetchone()
            if row is None:
                return False
            task_id, step_id, step_status = row
            if step_status != "in_progress":
                return False
            # A manual tick or untick replaces any step-check verification of this task.
            connection.execute(
                """
                INSERT INTO app.user_task_progress (user_id, task_id, status, completed_at, updated_at)
                VALUES (%s, %s, %s, CASE WHEN %s::boolean THEN now() END, now())
                ON CONFLICT (user_id, task_id) DO UPDATE SET
                    status = EXCLUDED.status, completed_at = EXCLUDED.completed_at,
                    verified_by_assessment_id = NULL,
                    needs_review = CASE WHEN %s::boolean THEN false ELSE app.user_task_progress.needs_review END,
                    updated_at = now()
                """,
                (user_id, task_id, "completed" if completed else "not_started", completed, completed),
            )
            _recompute_step(connection, user_id, step_id)
        return True

    def apply_check(self, user_id: int, roadmap_id: int, step_key: str, assessment_id: int,
                    verified: list[str], review: list[str]) -> None:
        """Tick the tasks a step check verified and flag the tasks it found for review."""
        with self._connect() as connection, connection.transaction():
            rows = connection.execute(
                """
                SELECT t.task_id, t.task_number, s.roadmap_step_id FROM app.roadmap_tasks AS t
                JOIN app.roadmap_steps AS s USING (roadmap_step_id)
                JOIN app.roadmaps AS r USING (roadmap_id)
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s
                  AND r.status = 'active'
                """,
                (roadmap_id, user_id, step_key),
            ).fetchall()
            if not rows:
                return
            by_item = {f"{step_key}.{number}": task_id for task_id, number, _ in rows}
            for item_id in verified:
                if item_id in by_item:
                    connection.execute(
                        """
                        INSERT INTO app.user_task_progress (user_id, task_id, status, completed_at,
                                                            verified_by_assessment_id, needs_review, updated_at)
                        VALUES (%s, %s, 'completed', now(), %s, false, now())
                        ON CONFLICT (user_id, task_id) DO UPDATE SET
                            status = 'completed',
                            completed_at = coalesce(app.user_task_progress.completed_at, now()),
                            verified_by_assessment_id = EXCLUDED.verified_by_assessment_id,
                            needs_review = false, updated_at = now()
                        """,
                        (user_id, by_item[item_id], assessment_id),
                    )
            for item_id in review:
                if item_id in by_item:
                    connection.execute(
                        """
                        INSERT INTO app.user_task_progress (user_id, task_id, status, needs_review, updated_at)
                        VALUES (%s, %s, 'not_started', true, now())
                        ON CONFLICT (user_id, task_id) DO UPDATE SET needs_review = true, updated_at = now()
                        """,
                        (user_id, by_item[item_id]),
                    )
            _recompute_step(connection, user_id, rows[0][2])


    def set_step(self, user_id: int, roadmap_id: int, step_key: str, status: str) -> bool:
        """Start, confirm, or reset a step without silently completing its checklist."""
        if status not in {"not_started", "in_progress", "completed"}:
            return False
        with self._connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT s.roadmap_step_id FROM app.roadmap_steps AS s
                JOIN app.roadmaps AS r USING (roadmap_id)
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s
                  AND r.status = 'active'
                """,
                (roadmap_id, user_id, step_key),
            ).fetchone()
            if row is None:
                return False
            step_id = row[0]
            if status == "completed":
                total, finished = connection.execute(
                    """
                    SELECT count(*), count(*) FILTER (WHERE p.status = 'completed')
                    FROM app.roadmap_tasks AS t
                    LEFT JOIN app.user_task_progress AS p
                      ON p.task_id = t.task_id AND p.user_id = %s
                    WHERE t.roadmap_step_id = %s
                    """,
                    (user_id, step_id),
                ).fetchone()
                if not total or total != finished:
                    return False
            if status == "not_started":
                connection.execute(
                    """
                    INSERT INTO app.user_task_progress (user_id, task_id, status, completed_at, updated_at)
                    SELECT %s, t.task_id, %s::app.progress_status, CASE WHEN %s::boolean THEN now() END, now()
                    FROM app.roadmap_tasks AS t WHERE t.roadmap_step_id = %s
                    ON CONFLICT (user_id, task_id) DO UPDATE SET
                        status = EXCLUDED.status, completed_at = EXCLUDED.completed_at, updated_at = now()
                    """,
                    (user_id, status, False, step_id),
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


def _recompute_step(connection: Any, user_id: int, step_id: int) -> None:
    """Set a step's progress row from its tasks. A step the learner started stays in progress."""
    total, finished = connection.execute(
        """
        SELECT count(*), count(*) FILTER (WHERE p.status = 'completed')
        FROM app.roadmap_tasks AS t
        LEFT JOIN app.user_task_progress AS p ON p.task_id = t.task_id AND p.user_id = %s
        WHERE t.roadmap_step_id = %s
        """,
        (user_id, step_id),
    ).fetchone()
    status = "in_progress" if finished else "not_started"
    connection.execute(
        """
        INSERT INTO app.user_roadmap_progress (user_id, roadmap_step_id, status, progress_percentage,
                                               started_at, completed_at, updated_at)
        VALUES (%s, %s, %s, %s, CASE WHEN %s::int > 0 THEN now() END,
                NULL, now())
        ON CONFLICT (user_id, roadmap_step_id) DO UPDATE SET
            status = CASE WHEN EXCLUDED.status = 'not_started'
                               AND app.user_roadmap_progress.started_at IS NOT NULL
                          THEN 'in_progress'::app.progress_status ELSE EXCLUDED.status END,
            progress_percentage = EXCLUDED.progress_percentage,
            started_at = coalesce(app.user_roadmap_progress.started_at, EXCLUDED.started_at),
            completed_at = CASE WHEN app.user_roadmap_progress.status = 'completed'
                                 THEN app.user_roadmap_progress.completed_at ELSE NULL END,
            updated_at = now()
        """,
        (user_id, step_id, status, round(100 * finished / total, 2) if total else 0, finished),
    )


def _level(value: str | None) -> str | None:
    return value if value in {"beginner", "intermediate", "advanced", "expert", "unknown"} else None


def _artifact_body(row: tuple) -> dict[str, Any]:
    return {
        "evidenceId": row[0], "skillId": row[1], "evidenceType": row[2], "title": row[3],
        "url": row[4], "notes": row[5], "photoData": row[6],
        "createdAt": row[7].isoformat() if isinstance(row[7], datetime) else row[7],
    }


def parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None
