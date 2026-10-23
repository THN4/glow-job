"""Deterministic recommended learning order for the planned skill-gap steps."""

from __future__ import annotations

from ai.roadmap.contracts import DraftStep, RoadmapDraft
from rag.context.agent_models import AgentContext


def recommended_skill_steps(draft: RoadmapDraft, context: AgentContext) -> list[DraftStep]:
    """Order planned skill gaps by market priority, while honoring explicit skill prerequisites.

    Priority is a recommendation, not a prerequisite. Only existing ``depends_on`` links
    between planned skills can override the priority order.
    """
    candidates = [item for item in context.roadmap_candidates
                  if item.learning_recommendation != "reference_only"]
    candidates.sort(key=lambda item: item.priority.rank or 10_000)
    rank = {item.skill_id: index for index, item in enumerate(candidates)}

    steps = {step.key: step for step in draft.steps if step.kind == "skill"}
    skill_keys = set(steps)
    prerequisites: dict[str, set[str]] = {key: set() for key in skill_keys}

    for key, step in steps.items():
        pending = list(step.depends_on)
        visited: set[str] = set()
        while pending:
            dependency_key = pending.pop()
            if dependency_key in visited:
                continue
            visited.add(dependency_key)
            dependency = next((item for item in draft.steps if item.key == dependency_key), None)
            if dependency is None:
                continue
            if dependency.kind == "skill" and dependency.key in skill_keys:
                prerequisites[key].add(dependency.key)
            elif dependency.kind == "foundation_check":
                pending.extend(dependency.depends_on)

    def priority(key: str) -> tuple[int, str]:
        step = steps[key]
        return rank.get(step.skill_id, 10_000), key

    remaining = {key: set(value) for key, value in prerequisites.items()}
    result: list[str] = []
    while remaining:
        available = sorted((key for key, deps in remaining.items() if not deps), key=priority)
        if not available:
            # Cycles are rejected by validation. Keep this helper deterministic if called earlier.
            result.extend(sorted(remaining, key=priority))
            break
        current = available[0]
        result.append(current)
        del remaining[current]
        for dependencies in remaining.values():
            dependencies.discard(current)

    return [steps[key] for key in result]


def recommended_route_steps(draft: RoadmapDraft, context: AgentContext) -> list[DraftStep]:
    """Return every roadmap step in one connected display route.

    Already-complete skills form the starting context. Foundation checks come before
    skills when dependency constraints allow, skill gaps follow market priority, and
    projects/career activities follow the learning steps. Real dependencies always win.
    """
    completed = [step for step in draft.steps if step.kind == "completed_skill"]
    active = {
        step.key: step for step in draft.steps
        if step.kind in {"foundation_check", "skill", "project", "career_activity"}
    }
    candidates = {item.skill_id: item for item in context.roadmap_candidates}

    def priority(key: str) -> tuple[int, int, str]:
        step = active[key]
        if step.kind == "foundation_check":
            return (0, 0, key)
        if step.kind == "skill":
            candidate = candidates.get(step.skill_id)
            rank = candidate.priority.rank if candidate else None
            return (1, rank or 10_000, key)
        return (2, 10_000, key)

    remaining = {
        key: {dependency for dependency in step.depends_on if dependency in active}
        for key, step in active.items()
    }
    result: list[DraftStep] = []
    while remaining:
        available = sorted((key for key, dependencies in remaining.items() if not dependencies),
                           key=priority)
        if not available:
            # Validation rejects cycles. Keep this helper deterministic if called earlier.
            available = sorted(remaining, key=priority)
        current = available[0]
        result.append(active[current])
        del remaining[current]
        for dependencies in remaining.values():
            dependencies.discard(current)

    return [*completed, *result]
