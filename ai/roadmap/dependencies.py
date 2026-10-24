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


def reviewed_relationship_ids(foundations: Iterable[FoundationMention | Mapping[str, Any]]) -> set[int]:
    """Return IDs for every reviewed relationship passed into this roadmap."""
    return {
        int(_field(relationship, "dependency_id"))
        for foundation in foundations
        for relationship in _field(foundation, "relationships")
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
                                         allowed: set[tuple[int, int]],
                                         allowed_relationship_ids: set[int] | None = None) -> RoadmapView:
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
    kept_edges = []
    for edge in view.edges:
        if edge.relationships:
            relationships = [item for item in edge.relationships
                             if (allowed_relationship_ids is None
                                 or item.dependency_id in allowed_relationship_ids)]
            if not relationships:
                continue
            edge.relationships = relationships
            pair = (edge.from_, edge.to)
            is_hard = pair in allowed
            edge.optional = not is_hard
            edge.kind = ("prerequisite" if is_hard else "related"
                         if all(item.relationship_type == "related" for item in relationships)
                         else "recommended_order")
            kept_edges.append(edge)
            continue
        target = by_key.get(edge.to)
        if (edge.kind != "prerequisite" or target is None or target.kind != "skill"
                or target.baseline_complete or edge.from_ in target.depends_on):
            kept_edges.append(edge)
    view.edges = kept_edges
    outgoing = {edge.from_ for edge in view.edges}
    if "goal" in by_key:
        view.edges.extend(
            Edge(from_=node.key, to="goal", optional=True, kind="recommended_order")
            for node in view.nodes if node.key != "goal" and node.key not in outgoing
        )
    return view
