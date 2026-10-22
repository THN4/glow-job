"""Check a model draft against Agent Context in code.

Repairable presentation errors become warnings. Missing learning evidence and
required prerequisite order are fatal so a model cannot publish an ungrounded plan.
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
    confirmed = {s.skill_id for s in context.user_context.confirmed_skills}
    completed_candidates = {
        skill_id: candidate for skill_id, candidate in mains.items()
        if candidate.learning_recommendation == "reference_only"
        and candidate.gap.status in {"covered", "not_assessed"}
        and skill_id in confirmed
    }
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
    scheduled_completed: set[int] = set()
    for step in draft.steps:
        label = f"Step '{step.key}'"
        if step.kind == "completed_skill":
            candidate = completed_candidates.get(step.skill_id)
            if candidate is None:
                fatal.append(f"{label} is marked completed, but skill_id {step.skill_id} is not a confirmed profile skill selected as a baseline.")
            elif step.skill_id in scheduled_completed:
                fatal.append(f"{label} repeats completed skill {candidate.skill_name}.")
            else:
                scheduled_completed.add(step.skill_id)
            if step.hours_min != 0 or step.hours_max != 0 or step.tasks or step.depends_on:
                fatal.append(f"{label} is a profile-complete skill and must have zero hours, no tasks, and no dependencies.")
            if len(step.details) > 3:
                warnings.append(f"{label}: trimmed skill details to three evidence-backed topics.")
                step.details = step.details[:3]
            if candidate is not None and candidate.teaching_content_status == "available" and not step.details:
                fatal.append(f"{label} needs at least one cited detail because reviewed learning content is available.")
            if candidate is not None and candidate.teaching_content_status != "available" and step.details:
                warnings.append(f"{label}: removed details because reviewed learning content is unavailable.")
                step.details = []
            for detail in step.details:
                kept = []
                for cite in detail.citations:
                    source = sources.get(cite.chunk_id)
                    allowed = source is not None and step.skill_id in source.used_by_skill_ids
                    if allowed and len(_norm(cite.quote)) >= 20 and _norm(cite.quote) in _norm(source.content):
                        kept.append(cite)
                    else:
                        warnings.append(f"{label}: removed a detail citation to chunk {cite.chunk_id} that did not match its source.")
                detail.citations = kept
                if not detail.citations:
                    fatal.append(f"{label}: skill detail '{detail.title}' needs a valid source citation.")
        elif step.kind == "skill":
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
        if not step.tasks and step.kind != "completed_skill":
            fatal.append(f"{label} has no tasks.")

        for task in step.tasks:
            kept = []
            for cite in task.citations:
                source = sources.get(cite.chunk_id)
                allowed = source is not None and (
                    step.kind not in {"skill", "completed_skill", "foundation_check"}
                    or step.skill_id in source.used_by_skill_ids
                )
                if allowed and len(_norm(cite.quote)) >= 20 and _norm(cite.quote) in _norm(source.content):
                    kept.append(cite)
                else:
                    warnings.append(f"{label}: removed a citation to chunk {cite.chunk_id} that did not match its source.")
            task.citations = kept
            if task.task_kind == "learn" and not kept:
                fatal.append(f"{label}: learn task '{task.title}' has no valid citation.")

    if _has_cycle(draft):
        fatal.append("Step dependencies form a cycle.")
    else:
        step_by_skill = {step.skill_id: step for step in draft.steps
                         if step.kind in {"skill", "completed_skill"}}
        check_by_skill = {step.skill_id: step.key for step in draft.steps if step.kind == "foundation_check"}
        for foundation in context.foundation_mentions:
            if foundation.confirmed_in_user_profile and foundation.user_level not in (None, "unknown"):
                continue
            for relationship in foundation.relationships:
                if (relationship.runtime_role != "global_ordering"
                        or relationship.dependency_type != "prerequisite"
                        or not relationship.blocks_unconditional_progress):
                    continue
                target_step = step_by_skill.get(relationship.target_skill_id)
                if target_step is None or target_step.kind == "completed_skill":
                    continue
                target_key = target_step.key
                foundation_step = step_by_skill.get(foundation.skill_id)
                prerequisite_keys = {key for key in (
                    foundation_step.key if foundation_step else None,
                    check_by_skill.get(foundation.skill_id),
                ) if key}
                if not prerequisite_keys:
                    fatal.append(f"Step '{target_key}' needs a prerequisite check for {foundation.skill_name}.")
                    continue
                if not any(_precedes(draft, prerequisite_key, target_key)
                           for prerequisite_key in prerequisite_keys):
                    fatal.append(f"Step '{target_key}' must depend on prerequisite {foundation.skill_name}.")
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
        if (skill_id not in scheduled and skill_id not in deferred
                and candidate.learning_recommendation == "needs_confirmation"):
            deferred[skill_id] = DraftDeferred(
                skill_id=skill_id, reason_code="NEEDS_CONFIRMATION",
                note="Reviewed learning content or learner confirmation is needed before planning this skill.",
            )
        if skill_id not in scheduled and skill_id not in deferred and candidate.learning_recommendation == "candidate":
            warnings.append(f"{candidate.skill_name} was not planned; it was added to deferred.")
            deferred[skill_id] = DraftDeferred(
                skill_id=skill_id, reason_code="OUTSIDE_TIME_BUDGET",
                note="Not scheduled in this roadmap. Plan it after the current steps.",
            )
    missing_completed = set(completed_candidates) - scheduled_completed
    if missing_completed:
        fatal.append("The roadmap must include completed profile-skill cards for: " + ", ".join(
            completed_candidates[skill_id].skill_name for skill_id in sorted(missing_completed)))
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
    elif next(step for step in draft.steps if step.key == draft.next_action.step_key).kind == "completed_skill":
        next_learning = next((step for step in draft.steps if step.kind != "completed_skill"), None)
        if next_learning is not None:
            warnings.append(f"Next action pointed to completed skill; it now points to '{next_learning.key}'.")
            draft.next_action.step_key = next_learning.key

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


def _precedes(draft: RoadmapDraft, prerequisite_key: str, target_key: str) -> bool:
    """True when the target depends directly or indirectly on the prerequisite."""
    dependencies = {step.key: step.depends_on for step in draft.steps}
    pending = list(dependencies.get(target_key, ()))
    seen: set[str] = set()
    while pending:
        key = pending.pop()
        if key == prerequisite_key:
            return True
        if key not in seen:
            seen.add(key)
            pending.extend(dependencies.get(key, ()))
    return False
