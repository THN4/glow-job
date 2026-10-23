"""Career goal and roadmap API. Contract: docs/roadmap/api-contract.md.

Every route requires the anonymous ``X-Session-Id`` that owns the profile, the same
rule as career match.
"""

from __future__ import annotations

from datetime import date
from functools import lru_cache
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import Field, model_validator

from app.features.resume.config import get_settings
from app.features.resume.errors import AppError
from app.features.resume.router import EnvelopeRoute
from app.features.roadmap.config import get_roadmap_settings
from app.features.roadmap.service import RoadmapService
from src.resume.schemas.cv_extraction import Camel

router = APIRouter(route_class=EnvelopeRoute, tags=["roadmap"])
SessionId = Header(alias="X-Session-Id", min_length=1, max_length=100)


@lru_cache
def get_roadmap_service() -> RoadmapService:
    settings = get_settings()
    if not settings.database_configured:
        raise AppError("ROADMAP_UNAVAILABLE")
    from app.features.roadmap.repository import RoadmapRepository

    return RoadmapService(get_roadmap_settings(), RoadmapRepository(settings))


class GoalBody(Camel):
    career_profile_id: int = Field(gt=0)
    target_role_title: str | None = Field(default=None, max_length=120)
    readiness_timeframe: Literal["three_months", "six_months", "one_year", "no_fixed_deadline"]
    target_date: date | None = None
    weekly_availability: Literal["under_2_hours", "hours_2_to_5", "hours_5_to_10", "hours_10_plus"]
    available_hours_per_week: float | None = Field(default=None, gt=0, le=80)
    preferred_learning_style: Literal["structured_courses", "hands_on_projects", "reading_articles",
                                      "videos_tutorials"]
    additional_context: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def future_date(self):
        if self.target_date and self.target_date <= date.today():
            raise ValueError("targetDate must be in the future")
        return self


class StartRoadmapBody(Camel):
    force: bool = False


class TaskProgressBody(Camel):
    completed: bool


class StepProgressBody(Camel):
    status: Literal["not_started", "in_progress", "completed"]


@router.get("/profiles/{profile_id}/goal")
async def get_goal(profile_id: str, session_id: str = SessionId,
                   svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    return {"goal": await svc.get_goal(profile_id, session_id)}


@router.put("/profiles/{profile_id}/goal")
async def put_goal(profile_id: str, body: GoalBody, session_id: str = SessionId,
                   svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    return {"goal": await svc.put_goal(profile_id, session_id, body.model_dump())}


@router.post("/profiles/{profile_id}/roadmaps", status_code=202)
async def start_roadmap(profile_id: str, body: StartRoadmapBody | None = None, session_id: str = SessionId,
                        svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    job = await svc.start(profile_id, session_id, force=bool(body and body.force))
    return job.body()


@router.get("/roadmap-jobs/{job_id}")
async def get_roadmap_job(job_id: str, session_id: str = SessionId,
                          svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    return svc.get_job(job_id, session_id).body()


@router.get("/profiles/{profile_id}/roadmaps/current")
async def get_current_roadmap(profile_id: str, session_id: str = SessionId,
                              svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    view = await svc.current(profile_id, session_id)
    return {"roadmap": view.model_dump(mode="json", by_alias=True)}


@router.put("/profiles/{profile_id}/roadmaps/{roadmap_id}/tasks/{task_id}")
async def put_task_progress(profile_id: str, roadmap_id: int, task_id: str, body: TaskProgressBody,
                            session_id: str = SessionId,
                            svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    view = await svc.set_task(profile_id, session_id, roadmap_id, task_id, body.completed)
    return {"roadmap": view.model_dump(mode="json", by_alias=True)}


@router.put("/profiles/{profile_id}/roadmaps/{roadmap_id}/steps/{step_key}")
async def put_step_progress(profile_id: str, roadmap_id: int, step_key: str, body: StepProgressBody,
                            session_id: str = SessionId,
                            svc: RoadmapService = Depends(get_roadmap_service)) -> dict[str, Any]:
    """Whole-step actions behind "Start learning", "Mark as completed" and skip."""
    view = await svc.set_step(profile_id, session_id, roadmap_id, step_key, body.status)
    return {"roadmap": view.model_dump(mode="json", by_alias=True)}
