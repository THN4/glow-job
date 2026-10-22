"""PostgreSQL persistence for confirmed anonymous Resume profiles."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import date, datetime, timezone
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from app.features.assessments.overlay import apply_accepted_assessments
from app.features.resume.config import CvSettings
from app.features.resume.errors import AppError
from app.features.resume.storage import StoredProfile
from src.shared.skill_normalization.normalizer import build_skill_catalog, match_catalog_skill

log = logging.getLogger("cv_extraction")
_DATE = re.compile(r"^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$")
_CONFIDENCE = {"high": 0.9, "medium": 0.6, "low": 0.3}


class DatabaseProfilesRepo:
    """Save the confirmed profile and its queryable facts in the app schema.

    The client-provided session ID is an anonymous identity subject. The full
    profile JSON is retained alongside normalized rows so fields without a
    relational column (for example languages and links) are not lost.
    """

    def __init__(self, settings: CvSettings):
        self._settings = settings

    async def get(self, profile_id: str) -> StoredProfile | None:
        return await asyncio.to_thread(self._get, profile_id)

    async def put(self, profile: StoredProfile) -> None:
        await asyncio.to_thread(self._put, profile)

    async def save_career_goal(
        self, profile_id: str, session_id: str, goal: dict[str, Any]
    ) -> None:
        await asyncio.to_thread(self._save_career_goal, profile_id, session_id, goal)

    async def list_versions(self, profile_id: str, session_id: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_versions, profile_id, session_id)

    async def restore_version(self, profile_id: str, version_id: int, session_id: str) -> StoredProfile | None:
        version = await asyncio.to_thread(self._get_version, profile_id, version_id, session_id)
        if version is None:
            return None
        restored = StoredProfile(
            profile_id=profile_id,
            session_id=session_id,
            profile=version.profile,
            created_at=version.created_at,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        await self.put(restored)
        return await self.get(profile_id)

    def _connect(self) -> psycopg.Connection[Any]:
        return psycopg.connect(
            host=self._settings.DB_HOST,
            port=self._settings.DB_PORT,
            dbname=self._settings.DB_NAME,
            user=self._settings.DB_USER,
            password=self._settings.DB_PASSWORD,
            connect_timeout=5,
        )

    def _get(self, profile_id: str) -> StoredProfile | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT p.profile_id, u.auth_subject, p.profile_data,
                           p.created_at, p.updated_at
                    FROM app.user_profiles AS p
                    JOIN app.users AS u USING (user_id)
                    WHERE p.profile_id = %s AND u.auth_provider = 'anonymous'
                    """,
                    (profile_id,),
                ).fetchone()
            if row is None:
                return None
            return StoredProfile(
                profile_id=row[0],
                session_id=row[1],
                profile=row[2],
                created_at=_iso(row[3]),
                updated_at=_iso(row[4]),
            )
        except Exception as exc:  # noqa: BLE001 - keep DB details out of API responses
            log.warning("profile database read failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def _put(self, saved: StoredProfile) -> None:
        try:
            with self._connect() as connection:
                with connection.transaction():
                    user_row = connection.execute(
                        """
                        INSERT INTO app.users (auth_provider, auth_subject)
                        VALUES ('anonymous', %s)
                        ON CONFLICT (auth_provider, auth_subject)
                        DO UPDATE SET updated_at = now()
                        RETURNING user_id
                        """,
                        (saved.session_id,),
                    ).fetchone()
                    user_id = user_row[0]

                    existing_owner = connection.execute(
                        "SELECT user_id FROM app.user_profiles WHERE profile_id = %s",
                        (saved.profile_id,),
                    ).fetchone()
                    if existing_owner is not None and existing_owner[0] != user_id:
                        raise AppError("PROFILE_NOT_FOUND")

                    previous = connection.execute(
                        """
                        SELECT profile_id, profile_data, created_at, updated_at
                        FROM app.user_profiles WHERE user_id = %s FOR UPDATE
                        """,
                        (user_id,),
                    ).fetchone()
                    if previous is not None and previous[0] != saved.profile_id:
                        raise AppError(
                            "PROFILE_ALREADY_EXISTS",
                            "This session already owns a profile. Start a new profile session or update the existing profile ID.",
                        )
                    if previous is not None and previous[1] != saved.profile:
                        connection.execute(
                            """
                            INSERT INTO app.user_profile_versions (
                                user_id, profile_id, profile_data, created_at, updated_at
                            ) VALUES (%s, %s, %s, %s, %s)
                            """,
                            (user_id, previous[0], Jsonb(previous[1]), previous[2], previous[3]),
                        )

                    profile = saved.profile
                    personal = profile.get("personal") or {}
                    derived = profile.get("derived") or {}
                    connection.execute(
                        """
                        INSERT INTO app.user_profiles (
                            user_id, profile_id, display_name, current_job_title,
                            years_experience, location, education_level,
                            field_of_study, background_summary, profile_data,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
                        )
                        ON CONFLICT (user_id) DO UPDATE SET
                            profile_id = EXCLUDED.profile_id,
                            display_name = EXCLUDED.display_name,
                            current_job_title = EXCLUDED.current_job_title,
                            years_experience = EXCLUDED.years_experience,
                            location = EXCLUDED.location,
                            education_level = EXCLUDED.education_level,
                            field_of_study = EXCLUDED.field_of_study,
                            background_summary = EXCLUDED.background_summary,
                            profile_data = EXCLUDED.profile_data,
                            updated_at = now()
                        """,
                        (
                            user_id,
                            saved.profile_id,
                            personal.get("fullName"),
                            derived.get("currentJobTitle"),
                            derived.get("yearsExperience"),
                            personal.get("location"),
                            derived.get("educationLevel"),
                            derived.get("fieldOfStudy"),
                            profile.get("summary"),
                            Jsonb(profile),
                            saved.created_at,
                        ),
                    )
                    self._replace_profile_items(connection, user_id, profile)
                    # Kept skill-check levels live in app.skill_assessments; write them back
                    # because the rows above were just recreated from the profile JSON.
                    apply_accepted_assessments(connection, user_id)
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001 - keep DB details out of API responses
            log.warning("profile database write failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def _save_career_goal(self, profile_id: str, session_id: str, goal: dict[str, Any]) -> None:
        """Save onboarding goal and preferences for the profile's owning user."""
        weekly_availability = {
            "under_2": "under_2_hours",
            "2_to_5": "hours_2_to_5",
            "5_to_10": "hours_5_to_10",
            "over_10": "hours_10_plus",
        }[goal["hours_per_week"]]
        learning_style = {
            "courses": "structured_courses",
            "projects": "hands_on_projects",
            "reading": "reading_articles",
            "videos": "videos_tutorials",
        }[goal["learning_style"]]
        current_status = {
            "student": "student",
            "full_time": "employed_full_time",
            "part_time": "employed_part_time",
            "between_opportunities": "between_opportunities",
            "other": "other",
        }[goal["situation"]]
        readiness_timeframe = {
            "3_months": "three_months",
            "6_months": "six_months",
            "1_year": "one_year",
            "custom": "no_fixed_deadline",
        }[goal["deadline"]]
        target_date = goal.get("custom_deadline_date") if goal["deadline"] == "custom" else None

        try:
            with self._connect() as connection:
                with connection.transaction():
                    profile_row = connection.execute(
                        """
                        SELECT p.user_id
                        FROM app.user_profiles AS p
                        JOIN app.users AS u USING (user_id)
                        WHERE p.profile_id = %s
                          AND u.auth_provider = 'anonymous'
                          AND u.auth_subject = %s
                        FOR UPDATE OF p
                        """,
                        (profile_id, session_id),
                    ).fetchone()
                    if profile_row is None:
                        raise AppError("PROFILE_NOT_FOUND")
                    user_id = profile_row[0]
                    connection.execute(
                        """
                        INSERT INTO app.user_career_goals (
                            user_id, target_role_title, is_primary, readiness_timeframe,
                            target_date, weekly_availability, preferred_learning_style,
                            additional_context
                        ) VALUES (
                            %s, %s, true, %s::app.readiness_timeframe, %s,
                            %s::app.weekly_availability_band,
                            %s::app.learning_preference, %s
                        )
                        ON CONFLICT (user_id) WHERE is_primary DO UPDATE SET
                            target_role_title = EXCLUDED.target_role_title,
                            readiness_timeframe = EXCLUDED.readiness_timeframe,
                            target_date = EXCLUDED.target_date,
                            weekly_availability = EXCLUDED.weekly_availability,
                            preferred_learning_style = EXCLUDED.preferred_learning_style,
                            additional_context = EXCLUDED.additional_context,
                            updated_at = now()
                        """,
                        (
                            user_id, goal["target_role"], readiness_timeframe,
                            target_date, weekly_availability, learning_style,
                            goal.get("notes") or None,
                        ),
                    )
                    connection.execute(
                        """
                        UPDATE app.user_profiles
                        SET current_status = %s::app.current_situation, updated_at = now()
                        WHERE user_id = %s
                        """,
                        (current_status, user_id),
                    )
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001 - keep DB details out of API responses
            log.warning("career goal database write failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def _list_versions(self, profile_id: str, session_id: str) -> list[dict[str, Any]]:
        try:
            with self._connect() as connection:
                return [
                    {"versionId": row[0], "profileId": row[1], "savedAt": _iso(row[2])}
                    for row in connection.execute(
                        """
                        SELECT v.version_id, v.profile_id, v.saved_at
                        FROM app.user_profile_versions v
                        JOIN app.user_profiles p USING (user_id)
                        JOIN app.users u USING (user_id)
                        WHERE p.profile_id = %s AND u.auth_provider = 'anonymous'
                          AND u.auth_subject = %s
                        ORDER BY v.saved_at DESC, v.version_id DESC
                        """,
                        (profile_id, session_id),
                    ).fetchall()
                ]
        except Exception as exc:  # noqa: BLE001
            log.warning("profile version list failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def _get_version(self, profile_id: str, version_id: int, session_id: str) -> StoredProfile | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT v.profile_id, v.profile_data, v.created_at, v.updated_at
                    FROM app.user_profile_versions v
                    JOIN app.user_profiles p USING (user_id)
                    JOIN app.users u USING (user_id)
                    WHERE p.profile_id = %s AND v.version_id = %s
                      AND u.auth_provider = 'anonymous' AND u.auth_subject = %s
                    """,
                    (profile_id, version_id, session_id),
                ).fetchone()
            if row is None:
                return None
            return StoredProfile(
                profile_id=profile_id,
                session_id=session_id,
                profile=row[1],
                created_at=_iso(row[2]),
                updated_at=_iso(row[3]),
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("profile version read failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def _replace_profile_items(
        self, connection: psycopg.Connection[Any], user_id: int, profile: dict[str, Any]
    ) -> None:
        # The profile row is the source of truth for the complete UI payload.
        # Replace normalized child rows atomically so edits remove deleted items.
        connection.execute("DELETE FROM app.user_skills WHERE user_id = %s", (user_id,))
        connection.execute("DELETE FROM app.user_educations WHERE user_id = %s", (user_id,))
        connection.execute("DELETE FROM app.user_experiences WHERE user_id = %s", (user_id,))
        connection.execute("DELETE FROM app.user_certifications WHERE user_id = %s", (user_id,))

        experience_ids: dict[str, int] = {}
        for item in profile.get("education") or []:
            start, start_precision = _date_value(item.get("startDate"))
            end, end_precision = _date_value(item.get("endDate"))
            description = item.get("description")
            if item.get("gpa"):
                description = "; ".join(part for part in (description, f"GPA: {item['gpa']}") if part)
            connection.execute(
                """
                INSERT INTO app.user_educations (
                    user_id, institution_name, degree, field_of_study,
                    start_date, start_date_precision, end_date, end_date_precision,
                    description, source, extraction_confidence, user_confirmed
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'resume', %s, true)
                """,
                (
                    user_id, item.get("institution"), item.get("degree"),
                    item.get("fieldOfStudy"), start, start_precision, end,
                    end_precision, description, _confidence(item.get("confidence")),
                ),
            )

        for item in profile.get("experience") or []:
            if not item.get("title"):
                # Preserve incomplete entries in profile_data, but don't violate
                # the normalized table's NOT NULL title constraint.
                continue
            item_id = item.get("id")
            db_id = self._insert_experience(connection, user_id, item, "work")
            if item_id:
                experience_ids[str(item_id)] = db_id

        for item in profile.get("projects") or []:
            if not item.get("name"):
                continue
            item_id = item.get("id")
            db_id = self._insert_experience(connection, user_id, item, "project")
            if item_id:
                experience_ids[str(item_id)] = db_id

        for item in profile.get("certifications") or []:
            if not item.get("name"):
                continue
            awarded_on, precision = _date_value(item.get("date"))
            connection.execute(
                """
                INSERT INTO app.user_certifications (
                    user_id, kind, name, issuer, awarded_on, awarded_on_precision,
                    details, source, extraction_confidence, user_confirmed
                ) VALUES (%s, %s::app.certification_kind, %s, %s, %s, %s, %s,
                          'resume', %s, true)
                """,
                (
                    user_id, item.get("kind") or "other", item["name"],
                    item.get("issuer"), awarded_on, precision, item.get("detail"),
                    _confidence(item.get("confidence")),
                ),
            )

        catalog = _catalog_from_database(connection)
        skill_ids: dict[tuple[str, object], int] = {}
        evidence_seen: set[tuple[int, str, int | None, str | None]] = set()

        def add_skill(
            name: str,
            *,
            item: dict[str, Any] | None = None,
            evidence_type: str | None = None,
            experience_id: int | None = None,
            evidence_text: str | None = None,
        ) -> int | None:
            raw_name = name.strip()
            if not raw_name:
                return None
            item = item or {}
            match = (item.get("catalogMatch") or {}) if item else {}
            if not match and catalog:
                match = match_catalog_skill(raw_name, catalog) or {}
            skill_id = match.get("skillId", match.get("skill_id"))
            if match.get("status") != "matched" and not match.get("skill_name"):
                skill_id = None
            if not isinstance(skill_id, int):
                skill_id = None
            key = ("catalog", skill_id) if skill_id is not None else ("raw", raw_name.casefold())
            user_skill_id = skill_ids.get(key)
            if user_skill_id is None:
                status = "matched" if skill_id is not None else (
                    "needs_review" if item.get("needsReview", True) else "unmatched"
                )
                proficiency = item.get("proficiency", "unknown")
                if proficiency not in {"beginner", "intermediate", "advanced", "expert", "unknown"}:
                    proficiency = "unknown"
                row = connection.execute(
                    """
                    INSERT INTO app.user_skills (
                        user_id, skill_id, raw_skill_name, normalized_skill_name,
                        match_status, proficiency_level, proficiency_basis,
                        source, confidence, user_confirmed
                    ) VALUES (%s, %s, %s, %s, %s::app.user_skill_match_status,
                              %s::app.proficiency_level, %s, %s, %s, true)
                    RETURNING user_skill_id
                    """,
                    (
                        user_id, skill_id, raw_name,
                        match.get("canonicalName") or match.get("skill_name"),
                        status, proficiency,
                        item.get("proficiencyBasis", "unknown"),
                        item.get("source", "cv"), _confidence(item.get("confidence")),
                    ),
                ).fetchone()
                user_skill_id = row[0]
                skill_ids[key] = user_skill_id

            if evidence_type:
                evidence_key = (user_skill_id, evidence_type, experience_id, evidence_text)
                if evidence_key not in evidence_seen:
                    connection.execute(
                        """
                        INSERT INTO app.user_skill_evidence (
                            user_skill_id, experience_id, evidence_type,
                            evidence_text, confidence
                        ) VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            user_skill_id, experience_id, evidence_type,
                            evidence_text, _confidence(item.get("confidence")),
                        ),
                    )
                    evidence_seen.add(evidence_key)
            return user_skill_id

        for item in profile.get("technicalSkills") or []:
            skill_id = add_skill(item.get("name", ""), item=item)
            if skill_id is None:
                continue
            for evidence in item.get("evidence") or []:
                evidence_item_id = evidence.get("itemId")
                add_skill(
                    item.get("name", ""), item=item,
                    evidence_type=evidence.get("evidenceType"),
                    experience_id=experience_ids.get(str(evidence_item_id)) if evidence_item_id else None,
                    evidence_text=evidence.get("text"),
                )

        for item in profile.get("tools") or []:
            add_skill(item.get("name", ""), item=item)

        # Technologies attached to jobs/projects are additional evidence for a
        # skill, not a second skill catalog. Resolve them against the same DB catalog.
        for collection, evidence_type in ((profile.get("experience") or [], "experience"),
                                          (profile.get("projects") or [], "project")):
            for item in collection:
                db_experience_id = experience_ids.get(str(item.get("id"))) if item.get("id") else None
                for technology in item.get("technologies") or []:
                    add_skill(
                        technology,
                        evidence_type=evidence_type,
                        experience_id=db_experience_id,
                        evidence_text=item.get("description"),
                    )

    @staticmethod
    def _insert_experience(
        connection: psycopg.Connection[Any], user_id: int,
        item: dict[str, Any], default_type: str,
    ) -> int:
        is_project = default_type == "project"
        employment_type = item.get("employmentType")
        experience_type = (
            "project" if is_project else
            "internship" if employment_type == "internship" else
            "other" if employment_type == "volunteer" else
            "work"
        )
        start, start_precision = _date_value(item.get("startDate"))
        end, end_precision = _date_value(item.get("endDate"))
        row = connection.execute(
            """
            INSERT INTO app.user_experiences (
                user_id, experience_type, title, organization, role, location,
                url, description, highlights, start_date, start_date_precision,
                end_date, end_date_precision, is_current, source,
                extraction_confidence, user_confirmed
            ) VALUES (
                %s, %s::app.experience_type, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, 'resume', %s, true
            ) RETURNING experience_id
            """,
            (
                user_id, experience_type,
                item.get("name") if is_project else item.get("title"),
                item.get("organization"), item.get("role") or employment_type,
                item.get("location"), item.get("url"), item.get("description"),
                Jsonb(item.get("highlights") or []), start, start_precision,
                end, end_precision, bool(item.get("isCurrent", False)),
                _confidence(item.get("confidence")),
            ),
        ).fetchone()
        return row[0]


def _catalog_from_database(connection: psycopg.Connection[Any]) -> dict[str, dict[str, object]]:
    skills = connection.execute(
        "SELECT skill_id, skill_name, skill_category, catalog_status FROM core.skills ORDER BY skill_id"
    ).fetchall()
    aliases = connection.execute(
        "SELECT skill_id, alias FROM core.skill_aliases ORDER BY alias_id"
    ).fetchall()
    return build_skill_catalog(skills, aliases) if skills else {}


def _date_value(value: object) -> tuple[date | None, str | None]:
    if not isinstance(value, str):
        return None, None
    match = _DATE.fullmatch(value.strip())
    if match is None:
        return None, None
    year, month, day = match.groups()
    precision = "day" if day else "month" if month else "year"
    try:
        return date(int(year), int(month or 1), int(day or 1)), precision
    except ValueError:
        return None, None


def _confidence(value: object) -> float | None:
    return _CONFIDENCE.get(value) if isinstance(value, str) else None


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
