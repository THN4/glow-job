"""Roadmap generation jobs: authorize, guard spend, build context, generate, save.

Generation runs in an in-process queue (one at a time) because a Gemini call can take
a minute or more. The API returns a job ID and the client polls it, as with CV extraction.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from ai.roadmap.contracts import RoadmapView
from ai.roadmap.cost import Pricing
from ai.roadmap.generate import GenerationFailed, generate_roadmap, prepare
from ai.roadmap.providers import RoadmapModel, create_model
from app.features.resume.errors import AppError
from app.features.resume.storage import JobQueue, TtlDict, now_iso
from app.features.roadmap.config import RoadmapSettings
from rag.context.agent_models import AgentContext
from rag.context.build import KnowledgeNotReady

log = logging.getLogger("roadmap")
JOB_TTL_SECONDS = 60 * 60
FAILURE_CODES = {"MODEL_REFUSAL", "MODEL_UNAVAILABLE"}


@dataclass
class RoadmapJob:
    job_id: str
    session_id: str
    profile_id: str
    user_id: int
    goal: dict[str, Any]
    force: bool = False
    status: str = "queued"  # queued | running | succeeded | failed
    stage: str = "queued"  # queued | preparing | generating | saving | done
    roadmap_id: int | None = None
    reused: bool = False
    error: dict[str, Any] | None = None
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)

    def body(self) -> dict[str, Any]:
        out: dict[str, Any] = {"jobId": self.job_id, "status": self.status, "stage": self.stage,
                               "roadmapId": self.roadmap_id, "reused": self.reused}
        if self.error:
            out["error"] = self.error
        return out


class RoadmapService:
    def __init__(self, settings: RoadmapSettings, repo: Any,
                 model_factory: Callable[[], RoadmapModel] | None = None):
        self.settings = settings
        self.repo = repo
        self._model_factory = model_factory or (lambda: create_model(
            settings.ROADMAP_PROVIDER, model_id=settings.ROADMAP_MODEL_ID, aws_region=settings.ROADMAP_AWS_REGION,
            effort=settings.ROADMAP_EFFORT, max_tokens=settings.ROADMAP_MAX_TOKENS,
            cache_context=settings.ROADMAP_CACHE_CONTEXT))
        self._model: RoadmapModel | None = None
        self.jobs: TtlDict[RoadmapJob] = TtlDict(JOB_TTL_SECONDS)
        self.queue = JobQueue(self._run)
        self.pricing = Pricing(settings.ROADMAP_PRICE_INPUT_PER_MTOK, settings.ROADMAP_PRICE_OUTPUT_PER_MTOK)

    @property
    def model(self) -> RoadmapModel:
        if self._model is None:
            self._model = self._model_factory()
        return self._model

    # ------------------------------------------------------------------ goals

    async def owner(self, profile_id: str, session_id: str) -> int:
        user_id = await asyncio.to_thread(self.repo.owner, profile_id, session_id)
        if user_id is None:
            raise AppError("PROFILE_NOT_FOUND")
        return user_id

    async def list_skill_artifacts(self, profile_id: str, session_id: str) -> list[dict[str, Any]]:
        user_id = await self.owner(profile_id, session_id)
        return await asyncio.to_thread(self.repo.list_skill_artifacts, user_id)

    async def add_skill_artifact(self, profile_id: str, session_id: str, skill_id: int,
                                 values: dict[str, Any]) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        artifact = await asyncio.to_thread(self.repo.create_skill_artifact, user_id, skill_id, values)
        if artifact is None:
            raise AppError("SKILL_NOT_FOUND")
        return artifact

    async def delete_skill_artifact(self, profile_id: str, session_id: str, artifact_id: int) -> None:
        user_id = await self.owner(profile_id, session_id)
        if not await asyncio.to_thread(self.repo.delete_skill_artifact, user_id, artifact_id):
            raise AppError("EVIDENCE_NOT_FOUND")

    async def get_goal(self, profile_id: str, session_id: str) -> dict[str, Any] | None:
        user_id = await self.owner(profile_id, session_id)
        return await asyncio.to_thread(self.repo.get_goal, user_id)

    async def progress_overview(self, profile_id: str, session_id: str) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        return await asyncio.to_thread(self.repo.progress_overview, user_id)

    async def put_goal(self, profile_id: str, session_id: str, goal: dict[str, Any]) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        return await asyncio.to_thread(self.repo.put_goal, user_id, goal)

    # ------------------------------------------------------------------ generation

    async def start(self, profile_id: str, session_id: str, *, force: bool = False) -> RoadmapJob:
        user_id = await self.owner(profile_id, session_id)
        goal = await asyncio.to_thread(self.repo.get_goal, user_id)
        if goal is None:
            raise AppError("GOAL_NOT_FOUND")
        if self.model.provider != "mock":
            await self._check_limits(user_id)
        job = RoadmapJob(job_id=f"rmj_{uuid.uuid4().hex}", session_id=session_id, profile_id=profile_id,
                         user_id=user_id, goal=goal, force=force)
        self.jobs.set(job.job_id, job)
        await self.queue.enqueue(job.job_id)
        return job

    def get_job(self, job_id: str, session_id: str) -> RoadmapJob:
        job = self.jobs.get(job_id)
        if job is None or job.session_id != session_id:
            raise AppError("JOB_NOT_FOUND", "The roadmap job was not found or has expired.")
        return job

    async def _check_limits(self, user_id: int) -> None:
        s = self.settings
        usage = await asyncio.to_thread(self.repo.usage, user_id)
        if s.ROADMAP_MONTHLY_BUDGET_USD and usage["month_cost_usd"] >= s.ROADMAP_MONTHLY_BUDGET_USD:
            raise AppError("ROADMAP_BUDGET_REACHED")
        if s.ROADMAP_DAILY_LIMIT and usage["all_today"] >= s.ROADMAP_DAILY_LIMIT:
            raise AppError("ROADMAP_LIMIT_REACHED")
        if s.ROADMAP_DAILY_LIMIT_PER_PROFILE and usage["user_today"] >= s.ROADMAP_DAILY_LIMIT_PER_PROFILE:
            raise AppError("ROADMAP_LIMIT_REACHED")

    def _update(self, job: RoadmapJob, **patch: Any) -> None:
        for key, value in patch.items():
            setattr(job, key, value)
        job.updated_at = now_iso()

    async def _run(self, job_id: str) -> None:
        job = self.jobs.get(job_id)
        if job is None:
            return
        started = time.monotonic()
        self._update(job, status="running", stage="preparing")
        try:
            context = await asyncio.to_thread(self._context, job)
            model = self.model
            prepared = prepare(context, model, effort=self.settings.ROADMAP_EFFORT)
            if not job.force:
                reused = await asyncio.to_thread(self.repo.reusable_roadmap, job.user_id, job.goal["goalId"],
                                                 prepared.input_sha256)
                if reused is not None:
                    self._update(job, status="succeeded", stage="done", roadmap_id=reused, reused=True)
                    log.info("roadmap reused job=%s roadmap=%s", job_id, reused)
                    return

            self._update(job, stage="generating")
            paid = model.provider != "mock"
            run_id = await asyncio.to_thread(self.repo.start_run, job.user_id, model.provider, model.model_id) \
                if paid else None
            try:
                result = await asyncio.to_thread(generate_roadmap, context, model, prepared=prepared,
                                                 pricing=self.pricing)
            except GenerationFailed as err:
                if run_id is not None:
                    await asyncio.to_thread(self.repo.finish_run, run_id, status="failed",
                                            usage=err.usage.as_dict(), cost_usd=err.cost_usd, error=err.code,
                                            metadata={"issues": err.issues})
                raise
            if run_id is not None:
                await asyncio.to_thread(self.repo.finish_run, run_id, status="succeeded",
                                        usage=result.usage.as_dict(), cost_usd=result.cost_usd,
                                        metadata={"warnings": result.warnings, "input_sha256": result.input_sha256})

            self._update(job, stage="saving")
            reason = "regenerate" if job.force else "generate"
            roadmap_id = await asyncio.to_thread(self.repo.save, job.user_id, job.goal, context, result,
                                                 run_id, reason)
            self._update(job, status="succeeded", stage="done", roadmap_id=roadmap_id)
            log.info("roadmap generated job=%s roadmap=%s provider=%s cost_usd=%.4f warnings=%d ms=%d",
                     job_id, roadmap_id, model.provider, result.cost_usd, len(result.warnings),
                     (time.monotonic() - started) * 1000)
        except AppError as err:
            self._update(job, status="failed", error=err.to_body())
        except GenerationFailed as err:
            code = err.code if err.code in FAILURE_CODES else "ROADMAP_GENERATION_FAILED"
            log.warning("roadmap generation failed job=%s code=%s issues=%s", job_id, err.code, err.issues)
            self._update(job, status="failed", error=AppError(code).to_body())
        except Exception:  # noqa: BLE001 - record and keep the worker alive
            log.exception("roadmap job crashed: %s", job_id)
            self._update(job, status="failed", error=AppError("INTERNAL_ERROR").to_body())

    def _context(self, job: RoadmapJob) -> AgentContext:
        fixture = self.settings.ROADMAP_CONTEXT_FIXTURE
        if fixture:
            log.warning("using development Agent Context fixture %s", fixture)
            return AgentContext.model_validate_json(Path(fixture).read_bytes())
        try:
            context = self.repo.build_context(job.profile_id, job.goal["careerProfileId"],
                                              self.settings.ROADMAP_DATE_BASIS)
        except KnowledgeNotReady as err:
            raise AppError("KNOWLEDGE_NOT_READY", str(err)) from err
        except ValueError as err:
            raise AppError("ROADMAP_CONTEXT_FAILED", f"The roadmap inputs could not be prepared: {err}") from err
        if context.user_context.career_goal is None:
            raise AppError("GOAL_NOT_FOUND")
        return context

    # ------------------------------------------------------------------ saved roadmaps

    async def current(self, profile_id: str, session_id: str) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        view = await asyncio.to_thread(self.repo.current, user_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view

    async def set_task(self, profile_id: str, session_id: str, roadmap_id: int, item_id: str,
                       completed: bool) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        if not await asyncio.to_thread(self.repo.set_task, user_id, roadmap_id, item_id, completed):
            raise AppError("TASK_NOT_FOUND")
        view = await asyncio.to_thread(self.repo.current, user_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view

    async def set_step(self, profile_id: str, session_id: str, roadmap_id: int, step_key: str,
                       status: str) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        current = await asyncio.to_thread(self.repo.current, user_id)
        if current is None:
            raise AppError("ROADMAP_NOT_FOUND")
        if any(node.key == step_key and node.baseline_complete for node in current.nodes):
            raise AppError("TASK_NOT_FOUND", "This skill is already complete in your confirmed profile.")
        if not await asyncio.to_thread(self.repo.set_step, user_id, roadmap_id, step_key, status):
            raise AppError("TASK_NOT_FOUND", "The roadmap step was not found.")
        view = await asyncio.to_thread(self.repo.current, user_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view
