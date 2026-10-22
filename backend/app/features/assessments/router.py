"""Skill assessments API. Contract: docs/assessments/api-contract.md.

Every route needs the anonymous ``X-Session-Id`` that owns the profile, like roadmap routes.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import Field

from app.features.assessments.service import AssessmentService
from app.features.resume.config import get_settings
from app.features.resume.errors import AppError
from app.features.resume.router import EnvelopeRoute
from src.resume.schemas.cv_extraction import Camel

router = APIRouter(route_class=EnvelopeRoute, tags=["assessments"])
SessionId = Header(alias="X-Session-Id", min_length=1, max_length=100)
EntryPoint = Literal["roadmap", "assessments", "skill_profile"]


@lru_cache
def get_assessment_service() -> AssessmentService:
    settings = get_settings()
    if not settings.database_configured:
        raise AppError("ASSESSMENT_UNAVAILABLE")
    from app.features.assessments.generator import build_generator
    from app.features.assessments.repository import AssessmentRepository
    from app.features.roadmap.repository import RoadmapRepository

    return AssessmentService(AssessmentRepository(settings, RoadmapRepository(settings)),
                             generator=build_generator(settings))


class StepTask(Camel):
    task_id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=300)
    chunk_ids: list[int] = Field(default_factory=list, max_length=10)


class StartStepCheckBody(Camel):
    step_key: str = Field(min_length=1, max_length=120)
    skill_id: int | None = Field(default=None, gt=0)
    roadmap_id: int | None = Field(default=None, gt=0)
    tasks: list[StepTask] | None = Field(default=None, max_length=20)
    entry_point: EntryPoint | None = None


class Answer(Camel):
    item_id: int = Field(gt=0)
    choice: int = Field(ge=0, le=3)


class FinishStepCheckBody(Camel):
    answers: list[Answer] = Field(min_length=1, max_length=20)


class ApplyBody(Camel):
    apply: bool


class StartLevelCheckBody(Camel):
    skill_id: int = Field(gt=0)
    entry_point: EntryPoint | None = None


class SelfCheckBody(Camel):
    answers: dict[str, Literal["yes", "unsure", "no"]] = Field(min_length=1, max_length=20)


class DecisionBody(Camel):
    decision: Literal["accepted", "declined"]


class QuickBody(Camel):
    skill_id: int = Field(gt=0)
    level: Literal["beginner", "intermediate", "advanced"]
    answer: str = Field(min_length=1, max_length=120)
    entry_point: EntryPoint | None = None
    step_key: str | None = Field(default=None, max_length=120)


Service = Depends(get_assessment_service)


@router.get("/profiles/{profile_id}/assessments")
async def overview(profile_id: str, session_id: str = SessionId, svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.overview(profile_id, session_id)


@router.post("/profiles/{profile_id}/assessments/step-checks", status_code=201)
async def start_step_check(profile_id: str, body: StartStepCheckBody, session_id: str = SessionId,
                           svc: AssessmentService = Service) -> dict[str, Any]:
    tasks = [{"task_id": t.task_id, "label": t.label, "chunk_ids": t.chunk_ids} for t in body.tasks or []]
    return await svc.start_step_check(profile_id, session_id, step_key=body.step_key, skill_id=body.skill_id,
                                      roadmap_id=body.roadmap_id, tasks=tasks, entry_point=body.entry_point)


@router.post("/profiles/{profile_id}/assessments/level-checks", status_code=201)
async def start_level_check(profile_id: str, body: StartLevelCheckBody, session_id: str = SessionId,
                            svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.start_level_check(profile_id, session_id, body.skill_id, body.entry_point)


@router.post("/profiles/{profile_id}/assessments/quick", status_code=201)
async def quick_question(profile_id: str, body: QuickBody, session_id: str = SessionId,
                         svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.quick_question(profile_id, session_id, skill_id=body.skill_id, level=body.level,
                                    answer=body.answer, entry_point=body.entry_point, step_key=body.step_key)


@router.get("/profiles/{profile_id}/assessments/{assessment_id}")
async def get_assessment(profile_id: str, assessment_id: int, session_id: str = SessionId,
                         svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.get(profile_id, session_id, assessment_id)


@router.post("/profiles/{profile_id}/assessments/{assessment_id}/finish")
async def finish_step_check(profile_id: str, assessment_id: int, body: FinishStepCheckBody,
                            session_id: str = SessionId, svc: AssessmentService = Service) -> dict[str, Any]:
    answers = {a.item_id: a.choice for a in body.answers}
    if len(answers) != len(body.answers):
        raise AppError("INVALID_REQUEST", "Answer each question once.")
    return await svc.finish_step_check(profile_id, session_id, assessment_id, answers)


@router.post("/profiles/{profile_id}/assessments/{assessment_id}/apply")
async def apply_step_check(profile_id: str, assessment_id: int, body: ApplyBody, session_id: str = SessionId,
                           svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.apply_step_check(profile_id, session_id, assessment_id, body.apply)


@router.post("/profiles/{profile_id}/assessments/{assessment_id}/self-check")
async def submit_self_check(profile_id: str, assessment_id: int, body: SelfCheckBody, session_id: str = SessionId,
                            svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.submit_self_check(profile_id, session_id, assessment_id, dict(body.answers))


@router.post("/profiles/{profile_id}/assessments/{assessment_id}/answers")
async def answer_question(profile_id: str, assessment_id: int, body: Answer, session_id: str = SessionId,
                          svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.answer_level_question(profile_id, session_id, assessment_id, body.item_id, body.choice)


@router.post("/profiles/{profile_id}/assessments/{assessment_id}/decision")
async def decide(profile_id: str, assessment_id: int, body: DecisionBody, session_id: str = SessionId,
                 svc: AssessmentService = Service) -> dict[str, Any]:
    return await svc.decide_level_check(profile_id, session_id, assessment_id, body.decision)
