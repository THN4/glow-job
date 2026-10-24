"""Generate one roadmap: compact context -> model -> validate (-> one repair) -> view."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from ai.roadmap.compact import Budget, compact_context, input_fingerprint, planning_budget
from ai.roadmap.contracts import Generation, RoadmapDraft, RoadmapView
from ai.roadmap.cost import Pricing, estimate_cost
from ai.roadmap.prompt import PROMPT_VERSION
from ai.roadmap.providers import ModelError, RoadmapModel, Usage
from ai.roadmap.validate import validate_draft
from ai.roadmap.view import build_view
from rag.context.agent_models import AgentContext


class GenerationFailed(Exception):
    def __init__(self, code: str, message: str, *, usage: Usage, cost_usd: float, retryable: bool = False,
                 issues: list[str] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.usage = usage
        self.cost_usd = cost_usd
        self.retryable = retryable
        self.issues = issues or []


@dataclass
class Prepared:
    budget: Budget
    compact: dict[str, Any]
    input_sha256: str


@dataclass
class GenerationResult:
    view: RoadmapView
    draft: RoadmapDraft
    warnings: list[str]
    usage: Usage
    cost_usd: float
    input_sha256: str


def prepare(context: AgentContext, model: RoadmapModel, *, today: date | None = None, effort: str = "") -> Prepared:
    budget = planning_budget(context, today or datetime.now(timezone.utc).date())
    compact = compact_context(context, budget)
    digest = input_fingerprint(compact, PROMPT_VERSION, model.provider, model.model_id, effort)
    return Prepared(budget, compact, digest)


def generate_roadmap(context: AgentContext, model: RoadmapModel, *, prepared: Prepared | None = None,
                     pricing: Pricing | None = None, max_repairs: int = 1) -> GenerationResult:
    prepared = prepared or prepare(context, model)
    pricing = pricing or Pricing()
    usage = Usage()

    def cost() -> float:
        return estimate_cost(usage, pricing, provider=model.provider)

    try:
        turn = model.generate(prepared.compact)
        usage = turn.usage
        check = validate_draft(turn.draft, context, prepared.budget)
        repairs = 0
        while check.fatal and repairs < max_repairs:
            repairs += 1
            turn = model.repair(turn, check.fatal)
            usage = turn.usage
            check = validate_draft(turn.draft, context, prepared.budget)
        if check.fatal:
            # Give the model one repair opportunity first. If only the learning
            # evidence remains unusable, publish that skill as a blurred
            # placeholder instead of failing the complete roadmap.
            fallback = validate_draft(turn.draft, context, prepared.budget,
                                      placeholder_invalid_citations=True)
            if not fallback.fatal:
                check = fallback
    except ModelError as err:
        usage = err.usage or usage
        raise GenerationFailed(err.code, err.message, usage=usage, cost_usd=cost(), retryable=err.retryable) from err
    if check.fatal:
        raise GenerationFailed("ROADMAP_VALIDATION_FAILED", "The generated roadmap did not pass validation.",
                               usage=usage, cost_usd=cost(), issues=check.fatal)

    generation = Generation(provider=model.provider, model=model.model_id, prompt_version=PROMPT_VERSION,
                            context_id=context.context_id)
    view = build_view(check.draft, context, prepared.budget, generation,
                      unavailable_skill_ids=check.unavailable_skill_ids,
                      generated_at=datetime.now(timezone.utc).isoformat())
    return GenerationResult(view=view, draft=check.draft, warnings=check.warnings, usage=usage,
                            cost_usd=cost(), input_sha256=prepared.input_sha256)
