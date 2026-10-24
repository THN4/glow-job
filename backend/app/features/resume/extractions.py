"""Durable anonymous Resume extraction-job persistence."""

from __future__ import annotations

import logging
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from app.features.resume.config import CvSettings
from app.features.resume.errors import AppError
from app.features.resume.storage import Job
from src.resume.schemas.cv_extraction import CvExtractionResult
from src.resume.versions import EXTRACTION_SCHEMA_VERSION, PROCESSING_VERSION, PROMPT_VERSION

log = logging.getLogger("cv_extraction")


class DatabaseJobsRepo:
    """Persist job status and structured extraction JSON, never the source CV bytes/text."""

    def __init__(self, settings: CvSettings):
        self._settings = settings
        # The worker needs the temporary upload ID, which is intentionally never persisted.
        self._active_jobs: dict[str, Job] = {}

    def _connect(self) -> psycopg.Connection[Any]:
        return psycopg.connect(
            host=self._settings.DB_HOST, port=self._settings.DB_PORT,
            dbname=self._settings.DB_NAME, user=self._settings.DB_USER,
            password=self._settings.DB_PASSWORD, connect_timeout=5,
        )

    def create(self, job: Job) -> None:
        if not job.session_id:
            raise AppError("INVALID_REQUEST", "An anonymous session is required.")
        try:
            with self._connect() as connection, connection.transaction():
                user_id = connection.execute(
                    """INSERT INTO app.users (auth_provider, auth_subject)
                       VALUES ('anonymous', %s)
                       ON CONFLICT (auth_provider, auth_subject)
                       DO UPDATE SET updated_at = now() RETURNING user_id""",
                    (job.session_id,),
                ).fetchone()[0]
                connection.execute(
                    "UPDATE app.resumes SET is_current = false WHERE user_id = %s AND is_current",
                    (user_id,),
                )
                job.resume_id = connection.execute(
                    """INSERT INTO app.resumes
                       (user_id, file_name, storage_key, mime_type, file_size_bytes, is_current)
                       VALUES (%s, %s, NULL, %s, %s, true) RETURNING resume_id""",
                    (user_id, _safe_file_name(job.file_name), job.content_type, job.file_size_bytes),
                ).fetchone()[0]
                connection.execute(
                    """INSERT INTO app.resume_extractions
                       (resume_id, job_id, status, stage, prompt_version,
                        extraction_schema_version, processing_version)
                       VALUES (%s, %s, 'pending', %s, %s, %s, %s)""",
                    (job.resume_id, job.job_id, job.stage, PROMPT_VERSION,
                     EXTRACTION_SCHEMA_VERSION, PROCESSING_VERSION),
                )
            self._active_jobs[job.job_id] = job
        except Exception as exc:  # noqa: BLE001
            log.warning("resume job create failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def get(self, job_id: str, session_id: str | None = None) -> Job | None:
        active = self._active_jobs.get(job_id)
        if active is not None:
            if session_id is not None and active.session_id != session_id:
                return None
            return active
        if not session_id:
            return None
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """SELECT e.job_id, r.resume_id, u.auth_subject, e.status::text,
                              e.stage, e.extracted_json, e.error_message, e.error_payload,
                              e.created_at, e.updated_at, r.file_sha256
                       FROM app.resume_extractions e
                       JOIN app.resumes r USING (resume_id)
                       JOIN app.users u USING (user_id)
                       WHERE e.job_id = %s AND u.auth_provider = 'anonymous'
                         AND u.auth_subject = %s""",
                    (job_id, session_id),
                ).fetchone()
            if row is None:
                return None
            status = {"completed": "succeeded", "pending": "queued"}.get(row[3], row[3])
            result = CvExtractionResult.model_validate(row[5]) if row[5] else None
            error = row[7] or ({"message": row[6]} if row[6] else None)
            return Job(
                job_id=row[0], upload_id="", session_id=row[2], resume_id=row[1],
                status=status, stage=row[4] or "reading", result=result, error=error,
                created_at=_iso(row[8]), updated_at=_iso(row[9]), file_sha256=row[10],
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("resume job read failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def update(self, job_id: str, **patch: Any) -> None:
        job = self.get(job_id)
        if job is None:
            return
        for key, value in patch.items():
            setattr(job, key, value)
        status = {"succeeded": "completed"}.get(job.status, job.status)
        result_json = Jsonb(job.result.model_dump(mode="json", by_alias=True)) if job.result else None
        error_message = (job.error or {}).get("message") if job.error else None
        error_payload = Jsonb(job.error) if job.error else None
        file_hash = job.file_sha256
        try:
            with self._connect() as connection, connection.transaction():
                connection.execute(
                    """UPDATE app.resume_extractions SET status = %s::app.extraction_status,
                              stage = %s, extracted_json = COALESCE(%s, extracted_json),
                              error_message = %s, error_payload = %s,
                              model_provider = COALESCE(%s, model_provider),
                              model_name = COALESCE(%s, model_name),
                              started_at = CASE WHEN %s = 'processing' THEN COALESCE(started_at, now()) ELSE started_at END,
                              completed_at = CASE WHEN %s IN ('completed', 'failed') THEN now() ELSE completed_at END,
                              updated_at = now()
                       WHERE job_id = %s""",
                    (status, job.stage, result_json, error_message, error_payload,
                     getattr(getattr(job.result, "meta", None), "provider", None),
                     getattr(getattr(job.result, "meta", None), "model", None),
                     status, status, job_id),
                )
                if file_hash and job.resume_id:
                    connection.execute(
                        "UPDATE app.resumes SET file_sha256 = %s WHERE resume_id = %s",
                        (file_hash, job.resume_id),
                    )
        except Exception as exc:  # noqa: BLE001
            log.warning("resume job update failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc

    def mark_source_deleted(self, job_id: str) -> None:
        try:
            with self._connect() as connection:
                connection.execute(
                    """UPDATE app.resumes r SET temporary_file_deleted_at = now()
                       FROM app.resume_extractions e
                       WHERE e.resume_id = r.resume_id AND e.job_id = %s""",
                    (job_id,),
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("resume source deletion timestamp failed: %s", type(exc).__name__)
        finally:
            # Once the temporary file is gone, polling can read the durable row.
            self._active_jobs.pop(job_id, None)

    def mark_interrupted(self) -> None:
        """A process-local queue cannot resume after restart; mark unfinished jobs explicitly."""
        try:
            with self._connect() as connection:
                connection.execute(
                    """UPDATE app.resume_extractions SET status = 'failed', stage = 'failed',
                              error_message = 'Backend restarted before extraction completed',
                              error_payload = '{"code":"EXTRACTION_INTERRUPTED","message":"Backend restarted before extraction completed","retryable":true}'::jsonb,
                              completed_at = now(), updated_at = now()
                       WHERE status IN ('pending', 'processing')"""
                )
                connection.execute(
                    """UPDATE app.resumes r SET temporary_file_deleted_at = COALESCE(temporary_file_deleted_at, now())
                       FROM app.resume_extractions e
                       WHERE e.resume_id = r.resume_id AND e.status = 'failed'
                         AND e.error_message = 'Backend restarted before extraction completed'"""
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("resume interrupted-job recovery failed: %s", type(exc).__name__)
            raise AppError("PROFILE_STORE_UNAVAILABLE") from exc


def _safe_file_name(value: str) -> str:
    # Original file names often contain personal information; only keep a generic extension.
    suffix = ".pdf" if value.casefold().endswith(".pdf") else ".image"
    return f"resume-upload{suffix}"


def _iso(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)
