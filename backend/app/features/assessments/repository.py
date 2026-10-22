"""PostgreSQL access for skill assessments. Every method opens its own connection; callers pass a
user ID only after ``owner`` matched the profile to the anonymous session."""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from app.features.assessments.overlay import apply_accepted_assessments
from app.features.resume.config import CvSettings

ROW = """
    assessment_id, user_id, skill_id, kind, status, decision, entry_point, roadmap_id, step_key,
    method, self_check_level, result_level, confidence, scoring_version, state, summary,
    started_at, completed_at, decided_at
"""
FIELDS = [f.strip() for f in ROW.split(",")]
UPDATABLE = {"status", "decision", "method", "self_check_level", "result_level", "confidence", "state", "summary",
             "completed_at", "decided_at"}


class AssessmentRepository:
    def __init__(self, settings: CvSettings, roadmap_repo: Any = None):
        self._settings = settings
        self._roadmaps = roadmap_repo

    def _connect(self) -> psycopg.Connection[Any]:
        s = self._settings
        return psycopg.connect(host=s.DB_HOST, port=s.DB_PORT, dbname=s.DB_NAME, user=s.DB_USER,
                               password=s.DB_PASSWORD, connect_timeout=5)

    # ------------------------------------------------------------------ lookups

    def owner(self, profile_id: str, session_id: str) -> int | None:
        with self._connect() as c:
            row = c.execute(
                """
                SELECT p.user_id FROM app.user_profiles AS p JOIN app.users AS u USING (user_id)
                WHERE p.profile_id = %s AND u.auth_provider = 'anonymous' AND u.auth_subject = %s
                """,
                (profile_id, session_id),
            ).fetchone()
        return row[0] if row else None

    def skill_name(self, skill_id: int) -> str | None:
        with self._connect() as c:
            row = c.execute("SELECT skill_name FROM core.skills WHERE skill_id = %s", (skill_id,)).fetchone()
        return row[0] if row else None

    def statements(self, skill_id: int) -> list[dict[str, Any]]:
        """Skill-specific statements where they exist, generic ones (with the name filled in) otherwise."""
        with self._connect() as c:
            rows = c.execute(
                """
                SELECT DISTINCT ON (st.level, st.position) st.statement_id, st.level, st.position, st.text,
                       st.skill_id IS NULL AS generic, s.skill_name
                FROM app.assessment_self_check_statements AS st
                LEFT JOIN core.skills AS s ON s.skill_id = %s
                WHERE st.skill_id = %s OR st.skill_id IS NULL
                ORDER BY st.level, st.position, st.skill_id NULLS LAST
                """,
                (skill_id, skill_id),
            ).fetchall()
        order = {"beginner": 0, "intermediate": 1, "advanced": 2}
        out = [{"id": r[0], "level": r[1], "position": r[2],
                "text": r[3].replace("{skill}", r[5] or "this skill") if r[4] else r[3]} for r in rows]
        return sorted(out, key=lambda s: (order[s["level"]], s["position"]))

    def level_item_ids(self, skill_id: int) -> dict[str, list[int]]:
        with self._connect() as c:
            rows = c.execute(
                "SELECT level, item_id FROM app.assessment_items WHERE skill_id = %s AND status = 'approved' "
                "ORDER BY item_id",
                (skill_id,),
            ).fetchall()
        out: dict[str, list[int]] = {}
        for level, item_id in rows:
            out.setdefault(level, []).append(item_id)
        return out

    def items_for_chunks(self, chunk_ids: list[int]) -> dict[int, list[int]]:
        """Step-check questions per chunk: reviewed ones, or on-demand ones while no reviewed one exists."""
        with self._connect() as c:
            rows = c.execute(
                """
                SELECT chunk_id, item_id FROM app.assessment_items AS i
                WHERE chunk_id = ANY(%s) AND (status = 'approved' OR status = 'provisional' AND NOT EXISTS (
                    SELECT 1 FROM app.assessment_items AS a WHERE a.chunk_id = i.chunk_id AND a.status = 'approved'))
                ORDER BY item_id
                """,
                (chunk_ids,),
            ).fetchall()
        out: dict[int, list[int]] = {}
        for chunk_id, item_id in rows:
            out.setdefault(chunk_id, []).append(item_id)
        return out

    def items(self, item_ids: list[int]) -> dict[int, dict[str, Any]]:
        with self._connect() as c:
            rows = c.execute(
                """
                SELECT item_id, skill_id, chunk_id, level, stem, options, answer_index, quote,
                       source_title, source_heading, source_url
                FROM app.assessment_items WHERE item_id = ANY(%s)
                """,
                (item_ids,),
            ).fetchall()
        keys = ["item_id", "skill_id", "chunk_id", "level", "stem", "options", "answer_index", "quote",
                "source_title", "source_heading", "source_url"]
        return {r[0]: dict(zip(keys, r)) for r in rows}

    def seen_items(self, user_id: int) -> set[int]:
        with self._connect() as c:
            rows = c.execute(
                """
                SELECT DISTINCT ans.item_id FROM app.skill_assessment_answers AS ans
                JOIN app.skill_assessments AS a USING (assessment_id) WHERE a.user_id = %s
                """,
                (user_id,),
            ).fetchall()
        return {r[0] for r in rows}

    # ------------------------------------------------------------------ assessments

    def create(self, user_id: int, *, skill_id: int | None, kind: str, scoring_version: str,
               entry_point: str | None = None, roadmap_id: int | None = None, step_key: str | None = None,
               state: dict | None = None, **fields: Any) -> int:
        columns = ["user_id", "skill_id", "kind", "scoring_version", "entry_point", "roadmap_id", "step_key", "state"]
        placeholders = ["%s"] * len(columns)
        values: list[Any] = [user_id, skill_id, kind, scoring_version, entry_point, roadmap_id, step_key,
                             Jsonb(state or {})]
        for key, value in fields.items():
            if key not in UPDATABLE:
                raise ValueError(f"Unknown assessment field {key}")
            columns.append(key)
            if value == "now()":
                placeholders.append("now()")
                continue
            placeholders.append("%s")
            values.append(Jsonb(value) if key in {"state", "summary"} else value)
        with self._connect() as c:
            return c.execute(
                f"INSERT INTO app.skill_assessments ({', '.join(columns)}) "
                f"VALUES ({', '.join(placeholders)}) RETURNING assessment_id",
                values,
            ).fetchone()[0]

    def get(self, assessment_id: int, user_id: int) -> dict[str, Any] | None:
        with self._connect() as c:
            row = c.execute(f"SELECT {ROW} FROM app.skill_assessments WHERE assessment_id = %s AND user_id = %s",
                            (assessment_id, user_id)).fetchone()
            if row is None:
                return None
            record = dict(zip(FIELDS, row))
            record["answers"] = [dict(zip(["item_id", "task_id", "level", "choice", "correct"], a)) for a in c.execute(
                "SELECT item_id, task_id, level, choice, correct FROM app.skill_assessment_answers "
                "WHERE assessment_id = %s ORDER BY answered_at, item_id", (assessment_id,)).fetchall()]
            record["skill_name"] = None
            if record["skill_id"]:
                name = c.execute("SELECT skill_name FROM core.skills WHERE skill_id = %s",
                                 (record["skill_id"],)).fetchone()
                record["skill_name"] = name[0] if name else None
        return record

    def update(self, assessment_id: int, **fields: Any) -> None:
        sets, values = [], []
        for key, value in fields.items():
            if key not in UPDATABLE:
                raise ValueError(f"Unknown assessment field {key}")
            if value == "now()":
                sets.append(f"{key} = now()")
                continue
            sets.append(f"{key} = %s")
            values.append(Jsonb(value) if key in {"state", "summary"} else value)
        with self._connect() as c:
            c.execute(f"UPDATE app.skill_assessments SET {', '.join(sets)} WHERE assessment_id = %s",
                      (*values, assessment_id))

    def add_answers(self, assessment_id: int, answers: list[tuple[int, str | None, str | None, int, bool]]) -> None:
        with self._connect() as c, c.transaction():
            for item_id, task_id, level, choice, correct in answers:
                c.execute(
                    """
                    INSERT INTO app.skill_assessment_answers (assessment_id, item_id, task_id, level, choice, correct)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (assessment_id, item_id, task_id, level, choice, correct),
                )

    def decide(self, assessment_id: int, user_id: int, decision: str, *, apply_level: bool) -> None:
        """Record the decision, and write the level into the profile in the same transaction."""
        with self._connect() as c, c.transaction():
            c.execute(
                "UPDATE app.skill_assessments SET decision = %s, decided_at = now() WHERE assessment_id = %s",
                (decision, assessment_id),
            )
            if apply_level and decision == "accepted":
                skill_id = c.execute("SELECT skill_id FROM app.skill_assessments WHERE assessment_id = %s",
                                     (assessment_id,)).fetchone()[0]
                apply_accepted_assessments(c, user_id, skill_id)

    # ------------------------------------------------------------------ roadmap steps (API roadmaps)

    def roadmap_step(self, user_id: int, roadmap_id: int, step_key: str) -> dict[str, Any] | None:
        """Study tasks of a saved roadmap step with the chunk IDs their citations use."""
        with self._connect() as c:
            step = c.execute(
                """
                SELECT s.roadmap_step_id, s.skill_id FROM app.roadmap_steps AS s JOIN app.roadmaps AS r USING (roadmap_id)
                WHERE r.roadmap_id = %s AND r.user_id = %s AND s.step_key = %s
                """,
                (roadmap_id, user_id, step_key),
            ).fetchone()
            if step is None:
                return None
            tasks = c.execute(
                """
                SELECT task_number, title, task_kind, citations FROM app.roadmap_tasks
                WHERE roadmap_step_id = %s ORDER BY task_number
                """,
                (step[0],),
            ).fetchall()
        return {"skill_id": step[1], "tasks": [
            {"task_id": f"{step_key}.{n}", "label": title,
             "chunk_ids": sorted({int(x["chunkId"]) for x in (cites or []) if x.get("chunkId")})}
            for n, title, kind, cites in tasks if kind == "learn"]}

    def apply_step(self, user_id: int, roadmap_id: int, step_key: str, assessment_id: int,
                   verified: list[str], review: list[str]) -> None:
        if self._roadmaps is None:
            raise RuntimeError("Roadmap repository is required to apply a step check to a saved roadmap")
        self._roadmaps.apply_check(user_id, roadmap_id, step_key, assessment_id, verified, review)

    # ------------------------------------------------------------------ assessments page

    def level_targets(self, user_id: int) -> list[dict[str, Any]]:
        """Profile skills plus skills that have a full level-check question set."""
        with self._connect() as c:
            profile = c.execute(
                """
                SELECT u.skill_id, s.skill_name, u.proficiency_level::text, u.proficiency_basis
                FROM app.user_skills AS u JOIN core.skills AS s USING (skill_id)
                WHERE u.user_id = %s AND u.user_confirmed AND u.match_status = 'matched'
                ORDER BY s.skill_name
                """,
                (user_id,),
            ).fetchall()
            banks = c.execute(
                """
                SELECT i.skill_id, s.skill_name, i.level, count(*) FROM app.assessment_items AS i
                JOIN core.skills AS s USING (skill_id) WHERE i.status = 'approved'
                GROUP BY i.skill_id, s.skill_name, i.level
                """
            ).fetchall()
        counts: dict[int, dict[str, int]] = {}
        names: dict[int, str] = {}
        for skill_id, name, level, n in banks:
            counts.setdefault(skill_id, {})[level] = n
            names[skill_id] = name
        out = [{"skill_id": r[0], "name": r[1], "level": r[2], "basis": r[3], "in_profile": True,
                "level_counts": counts.get(r[0], {})} for r in profile]
        in_profile = {r[0] for r in profile}
        out += [{"skill_id": sid, "name": names[sid], "level": None, "basis": None, "in_profile": False,
                 "level_counts": counts[sid]} for sid in sorted(counts) if sid not in in_profile]
        return out

    def activity(self, user_id: int, limit: int = 30) -> list[dict[str, Any]]:
        with self._connect() as c:
            rows = c.execute(
                f"""
                SELECT {ROW}, s.skill_name FROM app.skill_assessments AS a
                LEFT JOIN core.skills AS s USING (skill_id)
                WHERE a.user_id = %s AND a.status = 'completed'
                ORDER BY coalesce(a.decided_at, a.completed_at, a.started_at) DESC, a.assessment_id DESC
                LIMIT %s
                """,
                (user_id, limit),
            ).fetchall()
        return [dict(zip([*FIELDS, "skill_name"], r)) for r in rows]

    def latest_step_checks(self, user_id: int) -> list[dict[str, Any]]:
        with self._connect() as c:
            rows = c.execute(
                f"""
                SELECT DISTINCT ON (step_key) {ROW} FROM app.skill_assessments
                WHERE user_id = %s AND kind = 'step_check' AND status = 'completed'
                ORDER BY step_key, completed_at DESC, assessment_id DESC
                """,
                (user_id,),
            ).fetchall()
        return [dict(zip(FIELDS, r)) for r in rows]
