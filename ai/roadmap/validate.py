"""Check a model draft against Agent Context in code.

Problems code can fix safely (a bad citation, an unknown dependency key, a main skill
the model forgot) are fixed here and reported as warnings, so they never cost another
model call. Only structural problems are returned as fatal and trigger one repair call.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ai.roadmap import layout
from ai.roadmap.compact import Budget
from ai.roadmap.contracts import DraftDeferred, RoadmapDraft
from rag.context.agent_models import AgentContext

_SPACE = re.compile(r"\s+")
MAX_CHECK_HOURS = 2
BUDGET_TOLERANCE = 1.25


@dataclass
class Validation:
    draft: RoadmapDraft
    fatal: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _norm(text: str) -> str:
    return _SPACE.sub(" ", text).strip()


def validate_draft(draft: RoadmapDraft, context: AgentContext, budget: Budget) -> Validation:
    draft = draft.model_copy(deep=True)
    result = Validation(draft)
    fatal, warnings = result.fatal, result.warnings

    mains = {c.skill_id: c for c in context.roadmap_candidates}
    foundations = {f.skill_id: f for f in context.foundation_mentions}
    sources = {
        e.chunk_id: e for e in context.evidence_registry if "learning_content" in e.usage_roles
    }

    if not draft.steps:
        fatal.append("The roadmap has no steps.")
        return result

    keys = [step.key for step in draft.steps]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    if duplicates:
        fatal.append(f"Step keys must be unique; repeated: {', '.join(duplicates)}.")
    known = set(keys)

    scheduled: set[int] = set()
    for step in draft.steps:
        label = f"Step '{step.key}'"
        if step.kind == "skill":
            candidate = mains.get(step.skill_id)
            if candidate is None:
                fatal.append(f"{label} is a skill step, but skill_id {step.skill_id} is not a main skill.")
            elif candidate.learning_recommendation != "candidate":
                fatal.append(f"{label} plans {candidate.skill_name}, which is {candidate.learning_recommendation}.")
            elif step.skill_id in scheduled:
                fatal.append(f"{label} repeats main skill {candidate.skill_name}; plan each main skill once.")
            else:
                scheduled.add(step.skill_id)
        elif step.kind == "foundation_check":
            if step.skill_id not in foundations:
                fatal.append(f"{label} is a foundation check, but skill_id {step.skill_id} is not a listed foundation.")
            if step.hours_max > MAX_CHECK_HOURS:
                warnings.append(f"{label}: foundation check capped at {MAX_CHECK_HOURS} hours.")
                step.hours_max = MAX_CHECK_HOURS
                step.hours_min = min(step.hours_min, MAX_CHECK_HOURS)
            if any(task.task_kind == "learn" for task in step.tasks):
                warnings.append(f"{label}: learn tasks in a foundation check were changed to check tasks.")
                for task in step.tasks:
                    task.task_kind = "check"
        elif step.skill_id is not None:
            warnings.append(f"{label}: skill_id removed from a {step.kind} step.")
            step.skill_id = None

        if step.hours_min < 0 or step.hours_max < step.hours_min:
            fatal.append(f"{label} has an invalid hour range {step.hours_min}-{step.hours_max}.")
        unknown = [key for key in step.depends_on if key not in known or key == step.key]
        if unknown:
            warnings.append(f"{label}: removed unknown dependencies {unknown}.")
            step.depends_on = [key for key in step.depends_on if key in known and key != step.key]
        if not step.tasks:
            fatal.append(f"{label} has no tasks.")

        for task in step.tasks:
            kept = []
            for cite in task.citations:
                source = sources.get(cite.chunk_id)
                allowed = source is not None and (
                    step.kind not in {"skill", "foundation_check"} or step.skill_id in source.used_by_skill_ids
                )
                if allowed and len(_norm(cite.quote)) >= 20 and _norm(cite.quote) in _norm(source.content):
                    kept.append(cite)
                else:
                    warnings.append(f"{label}: removed a citation to chunk {cite.chunk_id} that did not match its source.")
            task.citations = kept
            if task.task_kind == "learn" and not kept:
                warnings.append(f"{label}: learn task '{task.title}' has no valid citation.")

    if _has_cycle(draft):
        fatal.append("Step dependencies form a cycle.")
    else:
        keys = [step.key for step in draft.steps]
        deps = {step.key: step.depends_on for step in draft.steps}
        needed = {dep for value in deps.values() for dep in value}
        deps["goal"] = [key for key in keys if key not in needed]
        rows = layout.row_count([*keys, "goal"], deps)
        if rows > layout.MAX_ROWS:
            fatal.append(
                f"The diagram needs {rows} rows, but the canvas fits {layout.MAX_ROWS} "
                f"(4 steps per row, goal last). Run independent steps side by side or merge steps."
            )

    deferred: dict[int, DraftDeferred] = {}
    for item in draft.deferred:
        if item.skill_id not in mains:
            warnings.append(f"Removed deferred skill_id {item.skill_id}; it is not a main skill.")
        elif item.skill_id in scheduled:
            warnings.append(f"Removed deferral of {mains[item.skill_id].skill_name}; it is already planned.")
        else:
            deferred.setdefault(item.skill_id, item)
    for skill_id, candidate in mains.items():
        if skill_id not in scheduled and skill_id not in deferred and candidate.learning_recommendation == "candidate":
            warnings.append(f"{candidate.skill_name} was not planned; it was added to deferred.")
            deferred[skill_id] = DraftDeferred(
                skill_id=skill_id, reason_code="OUTSIDE_TIME_BUDGET",
                note="Not scheduled in this roadmap. Plan it after the current steps.",
            )
    draft.deferred = list(deferred.values())

    allowed_confirmations = set(mains) | set(foundations)
    kept_confirmations = [c for c in draft.confirmations if c.skill_id in allowed_confirmations]
    if len(kept_confirmations) != len(draft.confirmations):
        warnings.append("Removed confirmations about skills outside the context.")
    draft.confirmations = kept_confirmations

    if draft.next_action.step_key not in known:
        root = next((s for s in draft.steps if not s.depends_on), draft.steps[0])
        warnings.append(f"Next action pointed to an unknown step; it now points to '{root.key}'.")
        draft.next_action.step_key = root.key

    if budget.total_max is not None:
        planned_min = sum(step.hours_min for step in draft.steps)
        if planned_min > budget.total_max * BUDGET_TOLERANCE:
            fatal.append(
                f"The plan needs at least {planned_min} hours, but the budget is at most "
                f"{budget.total_max:g} hours. Defer skills or shorten steps."
            )
        elif planned_min > budget.total_max:
            warnings.append(f"The plan's minimum hours ({planned_min}) are slightly above the budget ({budget.total_max:g}).")
    return result


def _has_cycle(draft: RoadmapDraft) -> bool:
    graph = {step.key: step.depends_on for step in draft.steps}
    state: dict[str, int] = {}

    def visit(key: str) -> bool:
        if state.get(key) == 1:
            return True
        if state.get(key) == 2:
            return False
        state[key] = 1
        if any(visit(dep) for dep in graph.get(key, ())):
            return True
        state[key] = 2
        return False

    return any(visit(key) for key in graph)
