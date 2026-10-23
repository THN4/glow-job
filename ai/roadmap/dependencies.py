"""Keep hard skill prerequisites tied to reviewed global-order relationships."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from ai.roadmap.contracts import Edge, RoadmapDraft, RoadmapView
from rag.context.agent_models import FoundationMention


def _field(record: Any, name: str) -> Any:
    return record.get(name) if isinstance(record, Mapping) else getattr(record, name)


def required_skill_pairs(foundations: Iterable[FoundationMention | Mapping[str, Any]]) -> set[tuple[int, int]]:
    """Return only relationships approved to block progress across skills."""
    return {
        (int(_field(foundation, "skill_id")), int(_field(relationship, "target_skill_id")))
        for foundation in foundations
        for relationship in _field(foundation, "relationships")
        if (_field(relationship, "dependency_type") == "prerequisite"
            and _field(relationship, "runtime_role") == "global_ordering"
            and _field(relationship, "blocks_unconditional_progress"))
    }


def remove_unsupported_skill_dependencies(draft: RoadmapDraft,
                                          allowed: set[tuple[int, int]]) -> list[tuple[str, str]]:
    """Drop model-authored hard links to skill steps unless the context requires them."""
    by_key = {step.key: step for step in draft.steps}
    removed: list[tuple[str, str]] = []
    for target in draft.steps:
        if target.kind != "skill":
            continue
        kept: list[str] = []
        for source_key in target.depends_on:
            source = by_key.get(source_key)
            if source is None:
                kept.append(source_key)  # Existing validation reports unknown keys.
            elif (source.skill_id is not None and target.skill_id is not None
                  and source.kind in {"skill", "completed_skill", "foundation_check"}
                  and (source.skill_id, target.skill_id) in allowed):
                kept.append(source_key)
            else:
                removed.append((source_key, target.key))
        target.depends_on = kept
    return removed


def remove_unsupported_view_dependencies(view: RoadmapView,
                                         allowed: set[tuple[int, int]]) -> RoadmapView:
    """Correct legacy saved views before layout and progress locking are calculated."""
    view = view.model_copy(deep=True)
    by_key = {node.key: node for node in view.nodes}
    for target in view.nodes:
        if target.kind != "skill" or target.baseline_complete or target.skill is None:
            continue
        target.depends_on = [
            source_key for source_key in target.depends_on
            if ((source := by_key.get(source_key)) is not None
                and source.skill is not None
                and (source.skill.skill_id, target.skill.skill_id) in allowed)
        ]
    view.edges = [
        edge for edge in view.edges
        if (edge.kind != "prerequisite"
            or (target := by_key.get(edge.to)) is None
            or target.kind != "skill"
            or target.baseline_complete
            or edge.from_ in target.depends_on)
    ]
    outgoing = {edge.from_ for edge in view.edges}
    if "goal" in by_key:
        view.edges.extend(
            Edge(from_=node.key, to="goal", optional=True, kind="recommended_order")
            for node in view.nodes if node.key != "goal" and node.key not in outgoing
        )
    return view
