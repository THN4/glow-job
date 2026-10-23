"""PostgreSQL access for the profile-scoped personal application tracker."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import psycopg

from app.features.resume.config import CvSettings

UI_TO_DB_STATUS = {
    "wishlist": "interested",
    "applied": "applied",
    "screening": "screening",
    "interview": "interviewing",
    "offer": "offered",
    "rejected": "rejected",
}
DB_TO_UI_STATUS = {value: key for key, value in UI_TO_DB_STATUS.items()}

_SELECT_APPLICATION = """
    SELECT a.application_id, a.company_name, c.company_name, a.job_title,
           a.status::text, a.created_at, a.updated_at, a.applied_at, a.notes,
           COALESCE(a.job_url, j.source_url),
           COALESCE(a.job_description, j.job_description),
           COALESCE(a.location, j.location), a.rejection_category, a.rejection_reason, a.job_id
    FROM app.job_applications AS a
    LEFT JOIN market.job_postings AS j ON j.job_id = a.job_id
    LEFT JOIN core.companies AS c ON c.company_id = COALESCE(a.company_id, j.company_id)
"""


class ApplicationsRepository:
    def __init__(self, settings: CvSettings):
        self._settings = settings

    def _connect(self) -> psycopg.Connection[Any]:
        s = self._settings
        return psycopg.connect(
            host=s.DB_HOST,
            port=s.DB_PORT,
            dbname=s.DB_NAME,
            user=s.DB_USER,
            password=s.DB_PASSWORD,
            connect_timeout=5,
        )

    def owner(self, profile_id: str, session_id: str) -> int | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT p.user_id FROM app.user_profiles AS p
                JOIN app.users AS u USING (user_id)
                WHERE p.profile_id = %s
                  AND u.auth_provider = 'anonymous'
                  AND u.auth_subject = %s
                """,
                (profile_id, session_id),
            ).fetchone()
        return row[0] if row else None

    def list_for_user(self, user_id: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                _SELECT_APPLICATION + " WHERE a.user_id = %s ORDER BY a.updated_at DESC, a.application_id DESC",
                (user_id,),
            ).fetchall()
            if not rows:
                return []
            histories = self._histories(connection, [row[0] for row in rows])
        return [self._view(row, histories.get(row[0], [])) for row in rows]

    def list_job_postings(self, limit: int | None = 60) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT j.job_id, c.company_name, j.job_title, j.job_description, j.location,
                       j.employment_type, j.publisher, j.source_url, j.posted_at,
                       COALESCE(skills.required_skills, ARRAY[]::text[]),
                       COALESCE(skills.preferred_skills, ARRAY[]::text[])
                FROM market.job_postings AS j
                LEFT JOIN core.companies AS c ON c.company_id = j.company_id
                LEFT JOIN LATERAL (
                    SELECT
                        array_agg(DISTINCT s.skill_name) FILTER (WHERE js.requirement_type = 'required') AS required_skills,
                        array_agg(DISTINCT s.skill_name) FILTER (WHERE js.requirement_type = 'preferred') AS preferred_skills
                    FROM market.job_skills AS js
                    JOIN core.skills AS s USING (skill_id)
                    WHERE js.job_id = j.job_id
                ) AS skills ON true
                ORDER BY COALESCE(j.posted_at, j.first_seen_at, j.collected_at) DESC, j.job_id DESC
                LIMIT %s
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": str(row[0]),
                "jobId": row[0],
                "company": row[1] or "Company not specified",
                "role": row[2],
                "jobDescription": row[3] or "",
                "description": ((row[3] or "").strip()[:260] + ("…" if row[3] and len(row[3].strip()) > 260 else "")),
                "location": row[4] or "Not specified",
                "workStyle": "Not specified",
                "experience": row[5] or "Not specified",
                "publisher": row[6] or "Source not specified",
                "sourceUrl": row[7] or "",
                "postedAt": row[8].isoformat() if row[8] else None,
                "requiredSkills": row[9] or [],
                "preferredSkills": row[10] or [],
            }
            for row in rows
        ]

    def job_matching_inputs(self, user_id: int) -> dict[str, Any]:
        # LIMIT NULL deliberately scans the catalog before ranking, rather than
        # choosing matches from only the latest Companies page.
        openings = {job["jobId"]: job for job in self.list_job_postings(None)}
        with self._connect() as connection:
            user_skills = connection.execute(
                """SELECT skill_id FROM app.user_skills
                   WHERE user_id = %s AND user_confirmed = true
                     AND match_status = 'matched' AND skill_id IS NOT NULL""",
                (user_id,),
            ).fetchall()
            goal = connection.execute(
                """SELECT target_role_title, career_id FROM app.user_career_goals
                   WHERE user_id = %s AND is_primary = true""", (user_id,),
            ).fetchone()
            rows = connection.execute(
                """SELECT j.job_id, cp.career_id, js.skill_id, s.skill_name, js.requirement_type
                   FROM market.job_postings AS j
                   JOIN core.career_profiles AS cp USING (career_profile_id)
                   LEFT JOIN market.job_skills AS js USING (job_id)
                   LEFT JOIN core.skills AS s USING (skill_id)
                   ORDER BY j.job_id, js.skill_id"""
            ).fetchall()
        jobs: dict[int, dict[str, Any]] = {}
        for job_id, career_id, skill_id, name, requirement_type in rows:
            if job_id not in openings:
                continue
            job = jobs.setdefault(job_id, {
                "opening": openings[job_id], "careerId": career_id, "requirements": [],
            })
            if skill_id is not None:
                job["requirements"].append({"skillId": skill_id, "name": name, "type": requirement_type})
        return {
            "userSkillIds": {row[0] for row in user_skills},
            "targetRole": goal[0] if goal else None,
            "goalCareerId": goal[1] if goal else None,
            "jobs": list(jobs.values()),
        }

    def save_job_posting(self, user_id: int, job_id: int) -> dict[str, Any] | None:
        with self._connect() as connection, connection.transaction():
            existing = connection.execute(
                "SELECT application_id FROM app.job_applications WHERE user_id = %s AND job_id = %s",
                (user_id, job_id),
            ).fetchone()
            if existing:
                application_id = existing[0]
            else:
                inserted = connection.execute(
                    """
                    INSERT INTO app.job_applications (
                        user_id, job_id, company_id, company_name, job_title, status
                    )
                    SELECT %s, j.job_id, j.company_id, c.company_name, j.job_title,
                           'interested'::app.application_status
                    FROM market.job_postings AS j
                    LEFT JOIN core.companies AS c ON c.company_id = j.company_id
                    WHERE j.job_id = %s
                    RETURNING application_id
                    """,
                    (user_id, job_id),
                ).fetchone()
                if inserted is None:
                    return None
                application_id = inserted[0]
                connection.execute(
                    """
                    INSERT INTO app.application_status_events (application_id, previous_status, status)
                    VALUES (%s, NULL, 'interested'::app.application_status)
                    """,
                    (application_id,),
                )
            row = connection.execute(
                _SELECT_APPLICATION + " WHERE a.user_id = %s AND a.application_id = %s",
                (user_id, application_id),
            ).fetchone()
            history = self._histories(connection, [application_id]).get(application_id, [])
        return self._view(row, history)

    def get_for_user(self, user_id: int, application_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                _SELECT_APPLICATION + " WHERE a.user_id = %s AND a.application_id = %s",
                (user_id, application_id),
            ).fetchone()
            if row is None:
                return None
            history = self._histories(connection, [application_id]).get(application_id, [])
        return self._view(row, history)

    def create(self, user_id: int, values: dict[str, Any]) -> dict[str, Any]:
        db_status = UI_TO_DB_STATUS[values["status"]]
        with self._connect() as connection, connection.transaction():
            application_id = connection.execute(
                """
                INSERT INTO app.job_applications (
                    user_id, company_name, job_title, status, applied_at, notes,
                    job_url, job_description, location, rejection_category, rejection_reason
                ) VALUES (%s, %s, %s, %s::app.application_status, %s, %s, %s, %s, %s, %s, %s)
                RETURNING application_id
                """,
                (
                    user_id, values["company"], values["role"], db_status, values["application_date"],
                    values["next_step"], values["job_url"], values["job_description"], values["location"],
                    values["rejection_category"], values["rejection_reason"],
                ),
            ).fetchone()[0]
            connection.execute(
                """
                INSERT INTO app.application_status_events (application_id, previous_status, status)
                VALUES (%s, NULL, %s::app.application_status)
                """,
                (application_id, db_status),
            )
            row = connection.execute(
                _SELECT_APPLICATION + " WHERE a.user_id = %s AND a.application_id = %s",
                (user_id, application_id),
            ).fetchone()
            history = self._histories(connection, [application_id]).get(application_id, [])
        return self._view(row, history)

    def update(self, user_id: int, application_id: int, values: dict[str, Any]) -> dict[str, Any] | None:
        db_status = UI_TO_DB_STATUS[values["status"]]
        with self._connect() as connection, connection.transaction():
            current = connection.execute(
                """
                SELECT status::text FROM app.job_applications
                WHERE user_id = %s AND application_id = %s
                FOR UPDATE
                """,
                (user_id, application_id),
            ).fetchone()
            if current is None:
                return None
            connection.execute(
                """
                UPDATE app.job_applications SET
                    company_name = %s, job_title = %s, status = %s::app.application_status,
                    applied_at = %s, notes = %s, job_url = %s, job_description = %s,
                    location = %s, rejection_category = %s, rejection_reason = %s, updated_at = now()
                WHERE user_id = %s AND application_id = %s
                """,
                (
                    values["company"], values["role"], db_status, values["application_date"],
                    values["next_step"], values["job_url"], values["job_description"], values["location"],
                    values["rejection_category"], values["rejection_reason"], user_id, application_id,
                ),
            )
            if current[0] != db_status:
                connection.execute(
                    """
                    INSERT INTO app.application_status_events (application_id, previous_status, status)
                    VALUES (%s, %s::app.application_status, %s::app.application_status)
                    """,
                    (application_id, current[0], db_status),
                )
            row = connection.execute(
                _SELECT_APPLICATION + " WHERE a.user_id = %s AND a.application_id = %s",
                (user_id, application_id),
            ).fetchone()
            history = self._histories(connection, [application_id]).get(application_id, [])
        return self._view(row, history)

    @staticmethod
    def _histories(connection: psycopg.Connection[Any], application_ids: list[int]) -> dict[int, list[dict[str, str]]]:
        rows = connection.execute(
            """
            SELECT application_id, previous_status::text, status::text, occurred_at
            FROM app.application_status_events
            WHERE application_id = ANY(%s)
            ORDER BY occurred_at, status_event_id
            """,
            (application_ids,),
        ).fetchall()
        histories: dict[int, list[dict[str, str]]] = {}
        for application_id, previous_status, status, occurred_at in rows:
            histories.setdefault(application_id, []).append({
                "status": DB_TO_UI_STATUS.get(status, status),
                "date": _display_date(occurred_at),
                "dateISO": _iso_date(occurred_at),
            })
        return histories

    @staticmethod
    def _view(row: tuple, history: list[dict[str, str]]) -> dict[str, Any]:
        (application_id, company_name, related_company, job_title, db_status, created_at, updated_at, applied_at,
         notes, job_url, job_description, location, rejection_category, rejection_reason, job_id) = row
        status = DB_TO_UI_STATUS.get(db_status, db_status)
        relevant_date = updated_at or created_at
        label = {"wishlist": "Added", "applied": "Applied", "interview": "Interview"}.get(status, "Updated")
        return {
            "id": str(application_id),
            "company": company_name or related_company or "Company not specified",
            "role": job_title,
            "status": status,
            "relevantDate": f"{label} {_display_date(relevant_date)}",
            "relevantDateISO": _iso_date(relevant_date),
            "nextStep": notes or "",
            "jobUrl": job_url or "",
            "applicationDate": _iso_date(applied_at) if applied_at else "",
            "jobDescription": job_description or "",
            "location": location or "",
            "statusHistory": history,
            "rejectionCategory": rejection_category,
            "rejectionReason": rejection_reason or "",
            "jobId": str(job_id) if job_id is not None else None,
        }


def _iso_date(value: date | datetime) -> str:
    return (value.date() if isinstance(value, datetime) else value).isoformat()


def _display_date(value: date | datetime) -> str:
    return (value.date() if isinstance(value, datetime) else value).strftime("%d %b %Y").lstrip("0")
