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
from rag.context.agent_models import AgentContext, ReplanTrigger
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
    replan_trigger: ReplanTrigger | None = None
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

    async def rejection_options(self, profile_id: str, session_id: str,
                                application_id: int) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        goal = await asyncio.to_thread(self.repo.get_goal, user_id)
        if goal is None:
            raise AppError("GOAL_NOT_FOUND")
        return await asyncio.to_thread(self.repo.rejection_options, user_id, profile_id, goal,
                                       application_id, self.settings.ROADMAP_DATE_BASIS)

    async def market_replan_options(self, profile_id: str, session_id: str) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        goal = await asyncio.to_thread(self.repo.get_goal, user_id)
        if goal is None:
            raise AppError("GOAL_NOT_FOUND")
        if await asyncio.to_thread(self.repo.current, user_id) is None:
            raise AppError("ROADMAP_NOT_FOUND", "Create your first roadmap before re-planning it.")
        return await asyncio.to_thread(self.repo.market_replan_options, user_id, profile_id, goal,
                                       self.settings.ROADMAP_DATE_BASIS)

    async def start(self, profile_id: str, session_id: str, *, force: bool = False,
                    rejection_application_id: int | None = None,
                    focus_skill_ids: tuple[int, ...] = (),
                    market_focus_skill_ids: tuple[int, ...] = ()) -> RoadmapJob:
        user_id = await self.owner(profile_id, session_id)
        goal = await asyncio.to_thread(self.repo.get_goal, user_id)
        if goal is None:
            raise AppError("GOAL_NOT_FOUND")
        if rejection_application_id is not None and market_focus_skill_ids:
            raise AppError("INVALID_REQUEST", "Choose either a rejection re-plan or a market re-plan.")
        if rejection_application_id is None and focus_skill_ids:
            raise AppError("INVALID_REQUEST", "A rejection application is required for selected skills.")
        if market_focus_skill_ids and rejection_application_id is not None:
            raise AppError("INVALID_REQUEST", "Choose either a rejection re-plan or a market re-plan.")
        trigger = None
        if rejection_application_id is not None:
            if self.settings.ROADMAP_CONTEXT_FIXTURE:
                raise AppError("REPLAN_NOT_ELIGIBLE", "Re-planning needs the live Agent Context, not a development fixture.")
            if force or not focus_skill_ids or len(focus_skill_ids) > 3 or len(set(focus_skill_ids)) != len(focus_skill_ids):
                raise AppError("INVALID_REQUEST", "Choose one to three distinct skills for a rejection replan.")
            if await asyncio.to_thread(self.repo.current, user_id) is None:
                raise AppError("ROADMAP_NOT_FOUND", "Create your first roadmap before re-planning it.")
            preview = await self.rejection_options(profile_id, session_id, rejection_application_id)
            selectable = {option["skillId"] for option in preview["options"]
                          if option["learningContentAvailable"]}
            if not set(focus_skill_ids) <= selectable:
                raise AppError("REPLAN_SKILL_UNAVAILABLE",
                               "Select a skill mentioned in your feedback with learning documents.")
            review_ids = tuple(skill_id for skill_id in focus_skill_ids
                               if any(item["skillId"] == skill_id and item.get("alreadyCompleted")
                                      for item in preview["options"]))
            trigger = ReplanTrigger(
                kind="application_rejection", application_id=rejection_application_id,
                job_title=preview["role"], rejection_category="skill-gap",
                reason_summary=preview["rejectionReason"][:500],
                focus_skill_ids=focus_skill_ids, review_skill_ids=review_ids,
                source="user_reported_application",
            )
        elif market_focus_skill_ids:
            if self.settings.ROADMAP_CONTEXT_FIXTURE:
                raise AppError("REPLAN_NOT_ELIGIBLE", "Market re-planning needs the live Agent Context, not a development fixture.")
            if force or not 1 <= len(market_focus_skill_ids) <= 3 or len(set(market_focus_skill_ids)) != len(market_focus_skill_ids):
                raise AppError("INVALID_REQUEST", "Choose one to three distinct market skills for a re-plan.")
            if await asyncio.to_thread(self.repo.current, user_id) is None:
                raise AppError("ROADMAP_NOT_FOUND", "Create your first roadmap before re-planning it.")
            preview = await self.market_replan_options(profile_id, session_id)
            selectable = {option["skillId"] for option in preview["options"]}
            if not set(market_focus_skill_ids) <= selectable:
                raise AppError("REPLAN_SKILL_UNAVAILABLE",
                               "Choose a skill shown in the current market alert.")
            window = preview.get("marketWindow")
            if not window:
                raise AppError("REPLAN_NOT_ELIGIBLE", "No market snapshot is available for this career.")
            trigger = ReplanTrigger(
                kind="market_update", focus_skill_ids=market_focus_skill_ids,
                source="demo_market_snapshot", is_demo=True,
                market_window={
                    "analysis_start_date": window["analysisStartDate"],
                    "analysis_end_date": window["analysisEndDate"],
                    "analysis_date_basis": window["analysisDateBasis"],
                },
            )
        if self.model.provider != "mock":
            await self._check_limits(user_id)
        job = RoadmapJob(job_id=f"rmj_{uuid.uuid4().hex}", session_id=session_id, profile_id=profile_id,
                         user_id=user_id, goal=goal, force=force, replan_trigger=trigger)
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
            reason = (job.replan_trigger.kind if job.replan_trigger else
                      "regenerate" if job.force else "generate")
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
            if job.replan_trigger:
                raise AppError("REPLAN_NOT_ELIGIBLE", "Re-planning needs the live Agent Context, not a development fixture.")
            log.warning("using development Agent Context fixture %s", fixture)
            return AgentContext.model_validate_json(Path(fixture).read_bytes())
        try:
            if job.replan_trigger and job.replan_trigger.kind == "application_rejection":
                preview = self.repo.rejection_options(job.user_id, job.profile_id, job.goal,
                                                      job.replan_trigger.application_id,
                                                      self.settings.ROADMAP_DATE_BASIS)
                selectable = {item["skillId"] for item in preview["options"] if item["learningContentAvailable"]}
                if not set(job.replan_trigger.focus_skill_ids) <= selectable:
                    raise AppError("REPLAN_SKILL_UNAVAILABLE")
                saved = self.repo.current_agent_context(job.user_id)
                if saved is not None:
                    previous_roadmap_id, previous_context = saved
                    candidates = {item.skill_id: item for item in previous_context.roadmap_candidates}
                    reusable_focus = all(
                        skill_id in candidates
                        and candidates[skill_id].teaching_content_status == "available"
                        and candidates[skill_id].rag_status in {"supported", "partial"}
                        and bool(candidates[skill_id].claims)
                        and candidates[skill_id].learning_recommendation in {"candidate", "reference_only"}
                        for skill_id in job.replan_trigger.focus_skill_ids
                    )
                    if reusable_focus:
                        snapshot = previous_context.model_dump(mode="json")
                        snapshot.pop("context_id", None)
                        snapshot.pop("generated_at", None)
                        snapshot["replan_trigger"] = job.replan_trigger.model_dump(mode="json")
                        snapshot["provenance"]["replan_base_roadmap_id"] = str(previous_roadmap_id)
                        snapshot["warnings"] = [
                            *snapshot["warnings"],
                            "Reviewed learning evidence was reused from the previous roadmap snapshot; no new document retrieval was run.",
                        ]
                        focus_order = {
                            skill_id: index
                            for index, skill_id in enumerate(job.replan_trigger.focus_skill_ids)
                        }
                        snapshot["roadmap_candidates"].sort(
                            key=lambda candidate: (
                                0 if candidate["skill_id"] in focus_order else 1,
                                focus_order.get(candidate["skill_id"], 0),
                            )
                        )
                        for candidate in snapshot["roadmap_candidates"]:
                            if (candidate["skill_id"] in job.replan_trigger.focus_skill_ids
                                    and candidate["learning_recommendation"] == "reference_only"):
                                candidate["learning_recommendation"] = "candidate"
                        snapshot["policy_versions"]["candidate_selection"] = "replan-focus-then-snapshot-order-v1"
                        reused_context = AgentContext.model_validate(snapshot)
                        log.info("roadmap context reused job=%s previous_roadmap=%s focus_skills=%s",
                                 job.job_id, previous_roadmap_id, job.replan_trigger.focus_skill_ids)
                        return reused_context
            elif job.replan_trigger and job.replan_trigger.kind == "market_update":
                preview = self.repo.market_replan_options(
                    job.user_id, job.profile_id, job.goal, self.settings.ROADMAP_DATE_BASIS,
                )
                selectable = {item["skillId"] for item in preview["options"]}
                if not set(job.replan_trigger.focus_skill_ids) <= selectable:
                    raise AppError("REPLAN_SKILL_UNAVAILABLE",
                                   "A selected market skill is no longer available in this alert.")
                window = preview.get("marketWindow") or {}
                current_window = {
                    "analysis_start_date": window.get("analysisStartDate"),
                    "analysis_end_date": window.get("analysisEndDate"),
                    "analysis_date_basis": window.get("analysisDateBasis"),
                }
                if current_window != job.replan_trigger.market_window.model_dump(mode="json"):
                    raise AppError("REPLAN_NOT_ELIGIBLE", "The market snapshot changed; review the market skills again.")
                saved = self.repo.current_agent_context(job.user_id)
                if saved is None:
                    raise AppError("ROADMAP_NOT_FOUND", "The active roadmap context is unavailable.")
                _previous_roadmap_id, previous_context = saved
                context = self.repo.extend_agent_context(
                    previous_context, profile_id=job.profile_id,
                    career_profile_id=job.goal["careerProfileId"],
                    date_basis=self.settings.ROADMAP_DATE_BASIS,
                    replan_trigger=job.replan_trigger,
                )
                log.info("roadmap context extended job=%s focus_skills=%s",
                         job.job_id, job.replan_trigger.focus_skill_ids)
                return context
            context = self.repo.build_context(job.profile_id, job.goal["careerProfileId"],
                                              self.settings.ROADMAP_DATE_BASIS, job.replan_trigger)
            if (job.replan_trigger and job.replan_trigger.kind == "market_update"
                    and context.career_context.market_window != job.replan_trigger.market_window):
                raise AppError("REPLAN_NOT_ELIGIBLE", "The market snapshot changed while preparing the roadmap.")
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

    async def history(self, profile_id: str, session_id: str) -> list[dict[str, Any]]:
        user_id = await self.owner(profile_id, session_id)
        return await asyncio.to_thread(self.repo.history, user_id)

    async def version(self, profile_id: str, session_id: str, roadmap_id: int) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        view = await asyncio.to_thread(self.repo.current, user_id, roadmap_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view

    async def set_task(self, profile_id: str, session_id: str, roadmap_id: int, item_id: str,
                       completed: bool) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        current = await asyncio.to_thread(self.repo.current, user_id)
        if current is None or current.roadmap_id != roadmap_id:
            raise AppError("ROADMAP_NOT_FOUND")
        step_key, _, _ = item_id.rpartition(".")
        node = next((item for item in current.nodes if item.key == step_key), None)
        if node is None or not any(task.id == item_id for task in node.checklist):
            raise AppError("TASK_NOT_FOUND")
        if node.status != "in_progress":
            raise AppError("ROADMAP_STEP_LOCKED", "Start this step after its prerequisites are complete.")
        if not await asyncio.to_thread(self.repo.set_task, user_id, roadmap_id, item_id, completed):
            raise AppError("ROADMAP_STEP_LOCKED", "Only an in-progress step can be changed.")
        view = await asyncio.to_thread(self.repo.current, user_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view

    async def set_step(self, profile_id: str, session_id: str, roadmap_id: int, step_key: str,
                       status: str) -> RoadmapView:
        user_id = await self.owner(profile_id, session_id)
        current = await asyncio.to_thread(self.repo.current, user_id)
        if current is None or current.roadmap_id != roadmap_id:
            raise AppError("ROADMAP_NOT_FOUND")
        node = next((item for item in current.nodes if item.key == step_key), None)
        if node is None:
            raise AppError("TASK_NOT_FOUND", "The roadmap step was not found.")
        if node.baseline_complete:
            raise AppError("TASK_NOT_FOUND", "This skill is already complete in your confirmed profile.")
        if status not in {"not_started", "in_progress", "completed"}:
            raise AppError("ROADMAP_STEP_LOCKED", "This step action is not supported.")
        if status == "in_progress":
            if node.status == "completed":
                raise AppError("ROADMAP_STEP_LOCKED", "Reset this step before starting it again.")
            blockers = [edge.from_ for edge in current.edges if edge.to == step_key and not edge.optional
                        and next((item.status for item in current.nodes if item.key == edge.from_), None)
                        != "completed"]
            if blockers:
                raise AppError("ROADMAP_STEP_LOCKED", "Complete the connected prerequisite steps first.")
        elif status == "completed":
            if node.status != "in_progress" or not node.checklist or not all(item.completed for item in node.checklist):
                raise AppError("CHECKLIST_INCOMPLETE", "Complete every checklist item before confirming this step.")
        elif status == "not_started" and node.status == "completed":
            completed_dependents = [edge.to for edge in current.edges if edge.from_ == step_key
                                    and next((item.status for item in current.nodes if item.key == edge.to), None)
                                    == "completed"]
            if completed_dependents:
                raise AppError("ROADMAP_STEP_LOCKED", "Reset the later completed steps first.")
        if not await asyncio.to_thread(self.repo.set_step, user_id, roadmap_id, step_key, status):
            if status == "completed":
                raise AppError("CHECKLIST_INCOMPLETE", "Complete every checklist item before confirming this step.")
            raise AppError("ROADMAP_STEP_LOCKED", "This step is locked or could not be updated.")
        view = await asyncio.to_thread(self.repo.current, user_id)
        if view is None:
            raise AppError("ROADMAP_NOT_FOUND")
        return view
