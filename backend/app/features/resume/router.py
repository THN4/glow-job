"""CV extraction API. Same endpoints and JSON as docs/cv-extraction/03-api-reference.md.

Mount into any FastAPI app (no lifespan or exception-handler wiring needed):

    from app.features.resume.router import router as cv_router
    app.include_router(cv_router, prefix="/api")
"""

from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any, Awaitable, Callable, Literal

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import ConfigDict, Field, ValidationError, model_validator

from app.features.resume.errors import AppError
from app.features.resume.services import Services, get_services
from app.features.resume.storage import Job, StoredProfile, now_iso
from app.features.resume.profiles import DatabaseProfilesRepo
from src.resume.normalization.postprocess import confirm_profile, count_review
from src.resume.normalization.catalog import resolve_profile_catalog_matches
from src.resume.parsing.preprocess import ALLOWED_MIME, detect_mime
from src.resume.schemas.cv_extraction import Camel, CvProfile, empty_profile
from src.resume.errors import ResumeProcessingError

log = logging.getLogger("cv_extraction")


class EnvelopeRoute(APIRoute):
    """Turns every failure into the documented ``{"error": {code, message, retryable}}`` body."""

    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        original = super().get_route_handler()

        async def handler(request: Request) -> Response:
            try:
                return await original(request)
            except AppError as err:
                return _error_response(err)
            except ResumeProcessingError as err:
                return _error_response(AppError(err.code, err.message))
            except RequestValidationError as err:
                details = [{"path": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in err.errors()]
                return _error_response(AppError("INVALID_REQUEST", details=details))
            except Exception:  # noqa: BLE001
                log.exception("unexpected error")
                return _error_response(AppError("INTERNAL_ERROR"))

        return handler


def _error_response(err: AppError) -> JSONResponse:
    return JSONResponse({"error": err.to_body()}, status_code=err.status)


router = APIRouter(route_class=EnvelopeRoute, tags=["cv-extraction"])


# --------------------------------------------------------------------------- request bodies


class CreateUploadBody(Camel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    size: int = Field(gt=0)


class StartExtractionBody(Camel):
    upload_id: str = Field(min_length=1, max_length=100)


class SaveProfileBody(Camel):
    session_id: str = Field(min_length=1, max_length=100)
    profile_id: str | None = Field(default=None, max_length=100)
    profile: Any


class SaveCareerGoalBody(Camel):
    model_config = ConfigDict(str_strip_whitespace=True)

    target_role: str = Field(min_length=1, max_length=120)
    deadline: Literal["3_months", "6_months", "1_year", "custom"]
    custom_deadline_date: date | None = None
    hours_per_week: Literal["under_2", "2_to_5", "5_to_10", "over_10"]
    learning_style: Literal["courses", "projects", "reading", "videos"]
    situation: Literal["student", "full_time", "part_time", "between_opportunities", "other"]
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def validate_custom_deadline(self) -> "SaveCareerGoalBody":
        if self.deadline == "custom" and self.custom_deadline_date is None:
            raise ValueError("customDeadlineDate is required for a custom deadline")
        if self.custom_deadline_date is not None and self.custom_deadline_date < date.today():
            raise ValueError("customDeadlineDate must be today or later")
        return self


# --------------------------------------------------------------------------- uploads


@router.post("/cv/uploads", status_code=201)
async def create_upload(body: CreateUploadBody, svc: Services = Depends(get_services)) -> dict[str, Any]:
    if body.content_type not in ALLOWED_MIME:
        raise AppError("UNSUPPORTED_FILE_TYPE")
    max_bytes = svc.settings.max_file_bytes
    if body.size > max_bytes:
        raise AppError("FILE_TOO_LARGE", f"The file is larger than {svc.settings.MAX_FILE_MB:g} MB.")
    meta, target = svc.uploads.create(body.file_name, body.content_type, body.size)
    return {"uploadId": meta.upload_id, "upload": target, "expiresInSeconds": 300}


@router.put("/cv/uploads/{upload_id}/file", status_code=204)
async def put_upload_file(upload_id: str, request: Request, svc: Services = Depends(get_services)) -> Response:
    """Local-mode upload target: the API itself receives the file body (raw bytes)."""
    meta = svc.uploads.get_meta(upload_id)
    if meta is None:
        raise AppError("UPLOAD_NOT_FOUND")
    max_bytes = svc.settings.max_file_bytes
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > max_bytes:
        raise AppError("FILE_TOO_LARGE")
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip()
    if content_type != meta.content_type:
        raise AppError("UNSUPPORTED_FILE_TYPE", "Content-Type does not match the declared file type.")

    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():  # enforce the limit while streaming
        total += len(chunk)
        if total > max_bytes:
            raise AppError("FILE_TOO_LARGE")
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise AppError("INVALID_REQUEST", "The file is empty.")
    detect_mime(data)  # reject non-PDF/image content early
    svc.uploads.write(upload_id, data)
    return Response(status_code=204)


# --------------------------------------------------------------------------- extractions


@router.post("/cv/extractions", status_code=202)
async def start_extraction(body: StartExtractionBody, svc: Services = Depends(get_services)) -> dict[str, Any]:
    if svc.uploads.get_meta(body.upload_id) is None or not svc.uploads.has_file(body.upload_id):
        raise AppError("UPLOAD_NOT_FOUND")
    limit = svc.settings.DAILY_EXTRACTION_LIMIT
    if limit > 0 and svc.usage.get_today() >= limit:
        raise AppError("DAILY_LIMIT_REACHED")
    job = Job(job_id=f"job_{uuid.uuid4()}", upload_id=body.upload_id)
    svc.jobs.create(job)
    await svc.queue.enqueue(job.job_id)
    return {"jobId": job.job_id, "status": "queued"}


@router.get("/cv/extractions/{job_id}")
async def get_extraction(job_id: str, svc: Services = Depends(get_services)) -> dict[str, Any]:
    job = svc.jobs.get(job_id)
    if job is None:
        raise AppError("JOB_NOT_FOUND")
    out: dict[str, Any] = {"jobId": job.job_id, "status": job.status, "stage": job.stage}
    if job.result is not None:
        result = job.result.model_copy(deep=True)
        catalog = svc.skill_catalog.load()
        if catalog is not None:
            result.profile = resolve_profile_catalog_matches(result.profile, catalog)
            result.meta.review_count = count_review(result.profile)
        out["result"] = result.model_dump(mode="json", by_alias=True)
    if job.error is not None:
        out["error"] = job.error
    return out


# --------------------------------------------------------------------------- profiles


@router.get("/profiles/empty")
async def get_empty_profile() -> dict[str, Any]:
    return {"profile": empty_profile().model_dump(mode="json", by_alias=True)}


@router.put("/profiles")
async def save_profile(request: Request, svc: Services = Depends(get_services)) -> dict[str, Any]:
    raw = await request.body()
    if len(raw) > 512 * 1024:
        raise AppError("INVALID_REQUEST", "Profile is too large.")
    try:
        body = SaveProfileBody.model_validate_json(raw)
    except ValidationError as err:
        raise AppError("INVALID_REQUEST", details=_issues(err)) from err
    try:
        profile = CvProfile.model_validate(body.profile)
    except ValidationError as err:
        raise AppError("INVALID_PROFILE", details=_issues(err)) from err

    now = now_iso()
    created_at = now
    profile_id = body.profile_id
    if profile_id:
        existing = await svc.profiles.get(profile_id)
        if existing is None:
            raise AppError("PROFILE_NOT_FOUND")
        created_at = existing.created_at
    else:
        profile_id = f"prf_{uuid.uuid4()}"
    # Never trust a skill ID or match supplied by the client. Clear submitted
    # matches, then recompute them from the current database catalog if enabled.
    profile = _clear_catalog_matches(profile)
    catalog = svc.skill_catalog.load()
    if catalog is not None:
        profile = resolve_profile_catalog_matches(profile, catalog)
    confirmed = confirm_profile(profile).model_dump(mode="json", by_alias=True)
    await svc.profiles.put(StoredProfile(profile_id, body.session_id, confirmed, created_at, now))
    return {"profileId": profile_id, "updatedAt": now}


@router.put("/profiles/{profile_id}/career-goal")
async def save_career_goal(
    profile_id: str,
    body: SaveCareerGoalBody,
    session_id: str = Header(alias="X-Session-Id", min_length=1, max_length=100),
    svc: Services = Depends(get_services),
) -> dict[str, bool]:
    """Persist onboarding career goal and preferences for an owned profile."""
    if not isinstance(svc.profiles, DatabaseProfilesRepo):
        raise AppError("PROFILE_STORE_UNAVAILABLE")
    await svc.profiles.save_career_goal(
        profile_id,
        session_id,
        body.model_dump(mode="json", by_alias=False),
    )
    return {"saved": True}


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str, svc: Services = Depends(get_services)) -> dict[str, Any]:
    stored = await svc.profiles.get(profile_id)
    if stored is None:
        raise AppError("PROFILE_NOT_FOUND")
    return {"profileId": stored.profile_id, "updatedAt": stored.updated_at, "profile": stored.profile}


@router.get("/profiles/{profile_id}/versions")
async def list_profile_versions(
    profile_id: str,
    session_id: str = Header(alias="X-Session-Id", min_length=1, max_length=100),
    svc: Services = Depends(get_services),
) -> dict[str, Any]:
    if not isinstance(svc.profiles, DatabaseProfilesRepo):
        raise AppError("PROFILE_STORE_UNAVAILABLE")
    return {"versions": await svc.profiles.list_versions(profile_id, session_id)}


@router.post("/profiles/{profile_id}/versions/{version_id}/restore")
async def restore_profile_version(
    profile_id: str,
    version_id: int,
    session_id: str = Header(alias="X-Session-Id", min_length=1, max_length=100),
    svc: Services = Depends(get_services),
) -> dict[str, Any]:
    if not isinstance(svc.profiles, DatabaseProfilesRepo):
        raise AppError("PROFILE_STORE_UNAVAILABLE")
    restored = await svc.profiles.restore_version(profile_id, version_id, session_id)
    if restored is None:
        raise AppError("PROFILE_NOT_FOUND")
    return {"profileId": restored.profile_id, "updatedAt": restored.updated_at}


@router.get("/career-profiles")
async def list_career_profiles(svc: Services = Depends(get_services)) -> dict[str, Any]:
    """List career profiles with market statistics for career selection."""
    if svc.career_match is None:
        raise AppError("CAREER_MATCH_UNAVAILABLE", "Career matching requires the shared database.")
    return {"careerProfiles": await svc.career_match.list_career_profiles()}


@router.get("/profiles/{profile_id}/career-match")
async def get_career_match(
    profile_id: str,
    session_id: str = Header(alias="X-Session-Id", min_length=1, max_length=100),
    career_profile_id: int = Query(alias="careerProfileId", gt=0),
    svc: Services = Depends(get_services),
) -> dict[str, Any]:
    """Compare a saved profile with the latest available Market statistics window."""
    if svc.career_match is None:
        raise AppError("CAREER_MATCH_UNAVAILABLE", "Career matching requires the shared database.")
    result = await svc.career_match.calculate(profile_id, session_id, career_profile_id)
    if result is None:
        raise AppError("PROFILE_NOT_FOUND")
    return result


def _issues(err: ValidationError) -> list[dict[str, str]]:
    return [{"path": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in err.errors()]


def _clear_catalog_matches(profile: CvProfile) -> CvProfile:
    return profile.model_copy(
        update={
            "technical_skills": [
                item.model_copy(update={"catalog_match": None})
                for item in profile.technical_skills
            ],
            "tools": [item.model_copy(update={"catalog_match": None}) for item in profile.tools],
        }
    )

