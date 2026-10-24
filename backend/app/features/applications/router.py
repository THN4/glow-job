"""Profile-scoped API for the personal application tracker."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, Query
from pydantic import Field, field_validator

from app.features.applications.service import ApplicationsService
from app.features.resume.config import get_settings
from app.features.resume.errors import AppError
from app.features.resume.router import EnvelopeRoute
from src.resume.schemas.cv_extraction import Camel

router = APIRouter(route_class=EnvelopeRoute, tags=["applications"])
SessionId = Header(alias="X-Session-Id", min_length=1, max_length=100)


@lru_cache
def get_applications_service() -> ApplicationsService:
    settings = get_settings()
    if not settings.database_configured:
        raise AppError("APPLICATIONS_UNAVAILABLE")
    from app.features.applications.repository import ApplicationsRepository

    return ApplicationsService(ApplicationsRepository(settings))


class ApplicationBody(Camel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    status: Literal["wishlist", "applied", "screening", "interview", "offer", "rejected"]
    next_step: str = Field(default="", max_length=2000)
    job_url: str | None = Field(default=None, max_length=2000)
    application_date: str | None = None
    job_description: str = Field(default="", max_length=20000)
    location: str = Field(default="", max_length=300)
    rejection_category: Literal[
        "not-specified", "skill-gap", "experience", "interview", "position-filled", "other"
    ] | None = None
    rejection_reason: str = Field(default="", max_length=4000)

    @field_validator("company", "role", "next_step", "job_description", "location", "rejection_reason")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("job_url", mode="before")
    @classmethod
    def normalize_job_url(cls, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("application_date", mode="before")
    @classmethod
    def normalize_application_date(cls, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


class SaveJobPostingBody(Camel):
    job_id: int = Field(gt=0)


def _values(body: ApplicationBody) -> dict[str, Any]:
    data = body.model_dump(by_alias=False)
    application_date = data["application_date"]
    if application_date is not None:
        from datetime import date
        try:
            data["application_date"] = date.fromisoformat(application_date)
        except ValueError as exc:
            raise AppError("INVALID_REQUEST", "Application date must use YYYY-MM-DD.") from exc
    data["job_url"] = data["job_url"] or None
    data["rejection_category"] = data["rejection_category"] if data["status"] == "rejected" else None
    data["rejection_reason"] = data["rejection_reason"] if data["status"] == "rejected" else ""
    return data


@router.get("/profiles/{profile_id}/applications")
async def list_applications(profile_id: str, session_id: str = SessionId,
                            svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.list(profile_id, session_id)


@router.get("/job-postings")
async def list_job_postings(limit: int = Query(default=60, gt=0, le=100),
                            svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.list_job_postings(limit)


@router.get("/profiles/{profile_id}/job-recommendations")
async def job_recommendations(profile_id: str, session_id: str = SessionId,
                              limit: int = Query(default=30, gt=0, le=100),
                              sort: Literal["coverage", "recent"] = Query(default="coverage"),
                              location: str | None = Query(default=None, min_length=1, max_length=300),
                              employment_type: str | None = Query(default=None, alias="employmentType", min_length=1, max_length=100),
                              skill_id: int | None = Query(default=None, alias="skillId", gt=0),
                              svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.job_recommendations(profile_id, session_id, limit, sort=sort,
                                          location=location, employment_type=employment_type, skill_id=skill_id)


@router.post("/profiles/{profile_id}/applications/from-job", status_code=201)
async def save_job_posting(profile_id: str, body: SaveJobPostingBody, session_id: str = SessionId,
                           svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.save_job_posting(profile_id, session_id, body.job_id)


@router.post("/profiles/{profile_id}/applications", status_code=201)
async def create_application(profile_id: str, body: ApplicationBody, session_id: str = SessionId,
                             svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.create(profile_id, session_id, _values(body))


@router.get("/profiles/{profile_id}/applications/{application_id}")
async def get_application(profile_id: str, application_id: int, session_id: str = SessionId,
                          svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.get(profile_id, session_id, application_id)


@router.put("/profiles/{profile_id}/applications/{application_id}")
async def update_application(profile_id: str, application_id: int, body: ApplicationBody,
                             session_id: str = SessionId,
                             svc: ApplicationsService = Depends(get_applications_service)) -> dict[str, Any]:
    return await svc.update(profile_id, session_id, application_id, _values(body))
