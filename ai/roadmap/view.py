"""Turn a validated draft into the API view the frontend renders.

Facts come from Agent Context (levels, gap status, source titles and URLs); the draft
only contributes the plan. Layout is computed here so the canvas does not depend on
positions written by the model. Text that depends on progress or on today's date
(statuses, subtitles, next step, time remaining) is recalculated by ``apply_progress``
every time a roadmap is read.
"""

from __future__ import annotations

from datetime import date

from ai.roadmap import layout as grid
from ai.roadmap.compact import Budget
from ai.roadmap.contracts import (
    ChecklistItem, Citation, Confirmation, ContentNotice, DeferredSkill, Edge, Generation,
    HoursRange, Layout, NextAction, NodeSkill, Position, Progress, RoadmapDraft, RoadmapNode,
    ProfileEvidence, RoadmapView, SkillDetail, Summary,
)
from ai.roadmap.ordering import recommended_route_steps, recommended_skill_steps
from rag.context.agent_models import AgentContext

NOT_READY_NOTICE = "Related foundation found, but learning content is not ready yet."
KIND = {"skill": "skill", "completed_skill": "skill", "foundation_check": "foundation-check", "project": "project",
        "career_activity": "career-activity"}
BASE_LIMITATIONS = [
    "Roadmap progress counts completed tasks only; it is not a career-readiness percentage.",
    "\"Not in your profile yet\" means your CV did not show it, not that you cannot do it.",
    "Hours are rough planning estimates, not measured learning time.",
]
TIMEFRAME_LABEL = {"three_months": "3 months", "six_months": "6 months", "one_year": "1 year",
                   "no_fixed_deadline": "No fixed deadline"}
GAP_LABEL = {
    "missing_from_profile": "Not in your profile yet",
    "not_assessed": "Level not assessed yet",
    "covered": "Confirmed in your profile · meets the market target",
    "proficiency_gap": "In your profile, below the level seen in job posts",
    "market_data_insufficient": "Not enough job-post data to compare",
}


def profile_label(gap_status: str | None, in_profile: bool, level: str | None) -> str:
    if gap_status in GAP_LABEL:
        return GAP_LABEL[gap_status]
    if not in_profile:
        return "Not in your profile yet"
    return f"In your profile ({level})" if level and level != "unknown" else "In your profile, level not assessed"


def build_view(draft: RoadmapDraft, context: AgentContext, budget: Budget, generation: Generation,
               *, generated_at: str, unavailable_skill_ids: set[int] | None = None) -> RoadmapView:
    unavailable_skill_ids = unavailable_skill_ids or set()
    registry = {e.chunk_id: e for e in context.evidence_registry}
    mains = {c.skill_id: c for c in context.roadmap_candidates}
    foundations = {f.skill_id: f for f in context.foundation_mentions}
    confirmed = {s.skill_id: s for s in context.user_context.confirmed_skills}
    names = {**{k: v.skill_name for k, v in mains.items()}, **{k: v.skill_name for k, v in foundations.items()}}
    planned = {step.skill_id for step in draft.steps if step.kind == "skill"}
    ordered_skills = recommended_skill_steps(draft, context)
    recommended_order = {step.key: index for index, step in enumerate(ordered_skills, 1)}
    route_steps = recommended_route_steps(draft, context)
    route_order = {step.key: index for index, step in enumerate(route_steps, 1)}

    def citation(chunk_id: int, quote: str) -> Citation:
        entry = registry[chunk_id]
        return Citation(chunk_id=chunk_id, title=entry.title, url=entry.source_url,
                        heading=entry.heading_path[-1] if entry.heading_path else None, quote=quote)

    def profile_evidence(skill_id: int | None) -> list[ProfileEvidence]:
        learner_skill = confirmed.get(skill_id) if skill_id is not None else None
        if learner_skill is None:
            return []
        evidence = [ProfileEvidence(evidence_type=item.evidence_type, excerpt=item.excerpt.strip()[:500])
                    for item in learner_skill.evidence if item.excerpt and item.excerpt.strip()]
        if evidence:
            return evidence[:3]

        # Some older profile saves linked a skill to a project but left the
        # evidence row's text empty. Use only the project text already present
        # in Agent Context; do not invent a claim or infer one from the skill name.
        for project in context.user_context.projects:
            if skill_id not in {item.skill_id for item in project.skills}:
                continue
            excerpt_parts = [part.strip() for part in (
                project.description or "", *project.highlights,
            ) if part and part.strip()]
            if excerpt_parts:
                excerpt = " ".join(excerpt_parts)[:500]
                evidence.append(ProfileEvidence(evidence_type="project", excerpt=excerpt))
                if len(evidence) == 3:
                    break
        return evidence

    nodes: list[RoadmapNode] = []
    for step in draft.steps:
        skill = None
        notice = None
        learning_content_available = True
        if step.skill_id in mains:
            c = mains[step.skill_id]
            learning_content_available = (
                step.kind != "skill"
                or (c.teaching_content_status == "available" and c.rag_status in {"supported", "partial"}
                    and c.skill_id not in unavailable_skill_ids)
            )
            skill = NodeSkill(skill_id=c.skill_id, name=c.skill_name, current_level=c.gap.current_level,
                              target_level=c.gap.target_level, gap_status=c.gap.status,
                              in_profile=c.skill_id in confirmed,
                              profile_label=profile_label(c.gap.status, c.skill_id in confirmed, c.gap.current_level),
                              profile_evidence=profile_evidence(c.skill_id))
            if c.teaching_content_status == "outline_only":
                notice = "Only a topic outline is available. You will need the full tutorial pages."
            if step.kind == "skill" and not learning_content_available:
                notice = "Learning content for this skill is not ready yet. This node is shown as a placeholder until reviewed material is available."
        elif step.skill_id in foundations:
            f = foundations[step.skill_id]
            skill = NodeSkill(skill_id=f.skill_id, name=f.skill_name, current_level=f.user_level,
                              target_level=None, gap_status=None, in_profile=f.confirmed_in_user_profile,
                              profile_label=profile_label(None, f.confirmed_in_user_profile, f.user_level),
                              profile_evidence=profile_evidence(f.skill_id))
            if f.learning_content_status == "unavailable":
                notice = NOT_READY_NOTICE
        checklist = [
            ChecklistItem(id=f"{step.key}.{number}", label=task.title, detail=task.detail,
                          task_kind=task.task_kind,
                          citations=[citation(c.chunk_id, c.quote) for c in task.citations])
            for number, task in enumerate(step.tasks, 1)
        ]
        details = [
            SkillDetail(title=item.title, detail=item.detail,
                        citations=[citation(c.chunk_id, c.quote) for c in item.citations])
            for item in step.details
        ]
        unique: dict[int, Citation] = {}
        for item in checklist:
            for cite in item.citations:
                unique.setdefault(cite.chunk_id, cite)
        for item in details:
            for cite in item.citations:
                unique.setdefault(cite.chunk_id, cite)
        if step.kind == "completed_skill" and not details:
            if skill is not None and skill.gap_status == "covered":
                notice = "Your profile and market level match are confirmed. Reviewed learning details are not available for this skill yet."
            else:
                notice = "This skill is confirmed in your profile. Your proficiency level and market alignment have not been verified, and reviewed learning details are not available yet."
        display_title = (
            skill.name if skill is not None and step.kind in {"skill", "completed_skill"}
            else step.title
        )
        nodes.append(RoadmapNode(
            key=step.key, kind=KIND[step.kind], title=display_title, summary=step.summary,
            why_it_matters=step.why, skill=skill,
            estimated_hours=HoursRange(min=step.hours_min, max=step.hours_max),
            depends_on=step.depends_on, checklist=checklist, details=details,
            learning_content_available=learning_content_available,
            baseline_complete=step.kind == "completed_skill", citations=list(unique.values()), notice=notice,
            recommended_order=recommended_order.get(step.key),
        ))

    goal = context.user_context.career_goal
    target_role = goal.target_role_title if goal else context.career_context.career_name
    duration = TIMEFRAME_LABEL.get(goal.readiness_timeframe, "") if goal and goal.readiness_timeframe else ""
    goal_subtitle = (f"Target: {goal.target_date.strftime('%b %d, %Y').replace(' 0', ' ')}" if goal and goal.target_date
                     else f"Target: {duration}" if duration and goal and goal.readiness_timeframe != "no_fixed_deadline"
                     else "No fixed deadline")
    nodes.append(RoadmapNode(
        key="goal", kind="goal", title=target_role, subtitle=goal_subtitle,
        summary=f"Your target role: {target_role}.",
        why_it_matters=["Everything above builds toward this goal."],
        depends_on=[],
    ))
    limitations = list(BASE_LIMITATIONS)
    if any(c.teaching_content_status != "available" for c in context.roadmap_candidates):
        limitations.append("Some skills only have a topic outline or partial sources so far.")

    by_key = {node.key: node for node in nodes}
    hard_foundations = {
        foundation.skill_id for foundation in context.foundation_mentions
        if any(relationship.runtime_role == "global_ordering"
               and relationship.dependency_type == "prerequisite"
               and relationship.blocks_unconditional_progress
               and relationship.target_skill_id in planned
               for relationship in foundation.relationships)
    }
    prerequisite_edges = [Edge(
        from_=dep, to=node.key,
        optional=(by_key[dep].kind == "foundation-check"
                  and by_key[dep].skill is not None
                  and by_key[dep].skill.skill_id not in hard_foundations),
        kind="prerequisite",
    )
             for node in nodes for dep in node.depends_on]
    edges = list(prerequisite_edges)
    edge_pairs = {(edge.from_, edge.to) for edge in edges}

    def already_reaches(start: str, target: str) -> bool:
        pending = [start]
        visited: set[str] = set()
        while pending:
            current = pending.pop()
            if current == target:
                return True
            if current not in visited:
                visited.add(current)
                pending.extend(edge.to for edge in edges if edge.from_ == current)
        return False

    def add_recommended_edge(source: str, target: str) -> None:
        pair = (source, target)
        if source == target or pair in edge_pairs or already_reaches(target, source):
            return
        edges.append(Edge(from_=source, to=target, optional=True, kind="recommended_order"))
        edge_pairs.add(pair)

    completed_steps = [step for step in route_steps if step.kind == "completed_skill"]
    check_keys = {step.skill_id: step.key for step in draft.steps if step.kind == "foundation_check"}
    skill_keys = {step.skill_id: step.key for step in ordered_skills}
    for foundation in context.foundation_mentions:
        check_key = check_keys.get(foundation.skill_id)
        if not check_key:
            continue
        for relationship in foundation.relationships:
            target_key = skill_keys.get(relationship.target_skill_id)
            if target_key:
                add_recommended_edge(check_key, target_key)

    def incoming(target: str) -> bool:
        return any(edge.to == target for edge in edges)

    def outgoing(source: str) -> bool:
        return any(edge.from_ == source for edge in edges)

    # Checks without a prior step branch from completed context when available, then
    # join the first planned gap if they do not already point to a related skill.
    for step in (item for item in route_steps if item.kind == "foundation_check"):
        if not incoming(step.key) and completed_steps:
            add_recommended_edge(completed_steps[-1].key, step.key)
        if not outgoing(step.key) and ordered_skills:
            add_recommended_edge(step.key, ordered_skills[0].key)

    # Projects without an explicit model-authored prerequisite can still sit at
    # the end of the learning route. Multiple projects remain parallel and can
    # converge at a later activity or at the goal.
    last_learning = (ordered_skills[-1].key if ordered_skills else
                     next((step.key for step in reversed(route_steps)
                           if step.kind in {"foundation_check", "completed_skill"}), None))
    projects = [step for step in route_steps if step.kind == "project"]
    activities = [step for step in route_steps if step.kind == "career_activity"]
    for project in projects:
        if not incoming(project.key) and last_learning:
            add_recommended_edge(last_learning, project.key)
    project_sinks = [step.key for step in projects if not outgoing(step.key)]
    for activity in activities:
        if not incoming(activity.key):
            parents = project_sinks or ([last_learning] if last_learning else [])
            for parent in parents:
                if parent:
                    add_recommended_edge(parent, activity.key)

    # Every branch reaches the target role. These optional joins show completion
    # of the roadmap path without claiming that every branch is a hard prerequisite.
    for node in nodes:
        if node.key != "goal" and not outgoing(node.key):
            add_recommended_edge(node.key, "goal")

    route_order["goal"] = len(route_order) + 1
    _place(nodes, edges, route_order)
    weekly = (HoursRange(min=budget.weekly_min, max=budget.weekly_max)
              if budget.weekly_min is not None and budget.weekly_max is not None else None)
    view = RoadmapView(
        generated_at=generated_at,
        generation=generation,
        summary=Summary(
            title=draft.title, overview=draft.overview, target_role=target_role,
            career_name=context.career_context.career_name,
            readiness_timeframe=goal.readiness_timeframe if goal else None,
            target_date=goal.target_date.isoformat() if goal and goal.target_date else None,
            weekly_availability=goal.weekly_availability if goal else None,
            learning_style=goal.preferred_learning_style if goal else None,
            estimated_hours=HoursRange(min=sum(s.hours_min for s in draft.steps),
                                       max=sum(s.hours_max for s in draft.steps)),
            budget_hours=None if budget.total_max is None else HoursRange(min=budget.total_min, max=budget.total_max),
            weekly_hours=weekly, duration_label=duration or "No fixed deadline", time_remaining_label="",
            planning_note=draft.planning_note, assumptions=list(budget.assumptions),
        ),
        next_action=NextAction(node_key=draft.next_action.step_key, text=draft.next_action.text),
        layout=Layout(columns=grid.COLUMNS, rows=max(n.position.row for n in nodes)),
        nodes=nodes,
        edges=edges,
        deferred=[DeferredSkill(skill_id=d.skill_id, skill_name=names[d.skill_id], reason_code=d.reason_code,
                                note=d.note) for d in draft.deferred],
        confirmations=[Confirmation(skill_id=c.skill_id, skill_name=names[c.skill_id], question=c.question)
                       for c in draft.confirmations],
        content_notices=[ContentNotice(skill_id=f.skill_id, skill_name=f.skill_name, notice=NOT_READY_NOTICE)
                         for f in context.foundation_mentions
                         if f.learning_content_status == "unavailable"
                         and any(r.target_skill_id in planned for r in f.relationships)],
        limitations=limitations,
        progress=Progress(completed_steps=0, total_steps=0, completed_tasks=0, total_tasks=0, percent=0),
    )
    return apply_progress(view, completed_tasks=set(), skipped_steps=set())


def apply_progress(view: RoadmapView, *, completed_tasks: set[str], skipped_steps: set[str],
                   started_steps: set[str] | None = None, today: date | None = None,
                   confirmed_steps: set[str] | None = None,
                   verified_tasks: set[str] | None = None, review_tasks: set[str] | None = None,
                   question_counts: dict[int, int] | None = None) -> RoadmapView:
    """Recalculate everything that depends on progress or on today's date.

    The goal node is not counted in progress. ``started_steps`` are steps the learner marked
    "in progress" without ticking a task yet.
    """
    view = view.model_copy(deep=True)
    route_order = {node.key: node.recommended_order for node in view.nodes if node.recommended_order is not None}
    _place(view.nodes, view.edges, route_order)
    view.layout = Layout(columns=grid.COLUMNS, rows=max(node.position.row for node in view.nodes))
    started_steps = started_steps or set()
    confirmed_steps = confirmed_steps or set()
    by_key = {node.key: node for node in view.nodes}
    hard_checks = {edge.from_ for edge in view.edges if not edge.optional
                   and by_key[edge.from_].kind == "foundation-check"}
    done_steps = total_steps = done_tasks = total_tasks = 0
    for node in view.nodes:
        if node.kind == "goal":
            continue
        if not node.learning_content_available:
            node.status = "not_started"
            node.subtitle = _subtitle(node)
            continue
        if node.baseline_complete:
            node.status = "completed"
            node.subtitle = _subtitle(node)
            continue
        for item in node.checklist:
            item.completed = item.id in completed_tasks
            item.verified = item.completed and item.id in (verified_tasks or set())
            item.needs_review = not item.completed and item.id in (review_tasks or set())
            item.question_count = (min(2, sum((question_counts or {}).get(c.chunk_id, 0) for c in item.citations))
                                   if item.task_kind == "learn" else 0)
        finished = sum(item.completed for item in node.checklist)
        if node.key in confirmed_steps:
            node.status = "completed"
        elif node.key in skipped_steps:
            node.status = "skipped"
        elif finished or node.key in started_steps:
            node.status = "in_progress"
        else:
            node.status = "not_started"
        node.subtitle = _subtitle(node)
        if node.status != "skipped" or node.key in hard_checks:
            if node.baseline_complete:
                continue
            total_steps += 1
            done_steps += node.status == "completed"
            total_tasks += len(node.checklist)
            done_tasks += finished if node.status != "skipped" else 0
    goal = next(node for node in view.nodes if node.kind == "goal")
    goal.status = "completed" if total_steps and done_steps == total_steps else "not_started"
    view.progress = Progress(
        completed_steps=done_steps, total_steps=total_steps, completed_tasks=done_tasks, total_tasks=total_tasks,
        percent=round(100 * done_tasks / total_tasks) if total_tasks else 0,
        label=f"{done_tasks} of {total_tasks} tasks done")

    ordered = sorted(view.nodes, key=lambda n: (n.position.row, n.position.column))
    def unlocked(node: RoadmapNode) -> bool:
        required = [edge for edge in view.edges if edge.to == node.key and not edge.optional]
        return all(by_key[edge.from_].status == "completed" for edge in required)

    chosen = by_key.get(view.next_action.node_key)
    if (chosen is None or not chosen.learning_content_available
            or chosen.status == "completed"
            or (chosen.status == "skipped" and chosen.key not in hard_checks)
            or not unlocked(chosen)):
        upcoming = next((n for n in ordered if n.kind != "goal"
                         and n.learning_content_available
                         and (n.status not in {"completed", "skipped"} or n.key in hard_checks)
                         and unlocked(n)),
                        None)
        if upcoming is not None:
            view.next_action = NextAction(node_key=upcoming.key, text=f"Next up: {upcoming.title}.")
        else:
            view.next_action = NextAction(node_key=goal.key, text="You have finished every step in this roadmap.")
    current = next((n for n in ordered if n.status == "in_progress"), None)
    view.current_node_key = current.key if current else view.next_action.node_key
    view.summary.time_remaining_label = _remaining(view, today or date.today())
    return view


def _subtitle(node: RoadmapNode) -> str:
    if not node.learning_content_available:
        return "Content not ready"
    if node.status == "completed":
        return "Completed"
    if node.status == "in_progress":
        return "In progress"
    if node.status == "skipped":
        return "Skipped"
    return {"project": "Upcoming project", "career-activity": "Career activity",
            "foundation-check": "Quick check"}.get(node.kind, "Upcoming")


def _remaining(view: RoadmapView, today: date) -> str:
    summary = view.summary
    if summary.target_date:
        days = (date.fromisoformat(summary.target_date) - today).days
        if days < 0:
            return "Target date has passed"
        if days < 14:
            return f"{days} days remaining"
        if days < 60:
            return f"{days // 7} weeks remaining"
        return f"{round(days / 30.4)} months remaining"
    if summary.readiness_timeframe in (None, "no_fixed_deadline"):
        return "No fixed deadline"
    return f"{summary.duration_label} plan"


def _place(nodes: list[RoadmapNode], edges: list[Edge],
           route_order: dict[str, int] | None = None) -> None:
    keys = [node.key for node in nodes]
    deps = {node.key: list(node.depends_on) for node in nodes}
    for edge in edges:
        if not edge.optional:
            deps.setdefault(edge.to, []).append(edge.from_)
    layers = grid.depth(keys, deps, route_order)
    positions = grid.place(keys, deps, route_order)
    counts: dict[int, int] = {}
    for node in nodes:
        node.layer = layers[node.key]
        node.order = counts.get(node.layer, 0)
        counts[node.layer] = node.order + 1
        row, column = positions[node.key]
        node.position = Position(row=row, column=column)
