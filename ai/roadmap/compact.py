"""Reduce Agent Context to what the model needs, and derive the planning budget in code.

Input tokens are most of the cost of one generation, so this keeps only teaching
sources the model may cite, drops repeated metadata, and deduplicates user excerpts.
Dependency-proof chunks are summarized by their relationship, not sent in full.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from typing import Any

from rag.context.agent_models import AgentContext

# Hours per week for each availability band. The top band has no upper bound in
# the product, so 15 h is a stated planning assumption rather than user data.
WEEKLY_HOURS = {
    "under_2_hours": (1.0, 2.0),
    "hours_2_to_5": (2.0, 5.0),
    "hours_5_to_10": (5.0, 10.0),
    "hours_10_plus": (10.0, 15.0),
}
TIMEFRAME_WEEKS = {"three_months": 13, "six_months": 26, "one_year": 52}
DEFAULT_HORIZON_WEEKS = 12
MAX_EXCERPTS = 3
EXCERPT_CHARS = 300


@dataclass(frozen=True)
class Budget:
    weekly_min: float | None
    weekly_max: float | None
    weeks: int
    total_min: float | None
    total_max: float | None
    assumptions: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "weekly_hours": [self.weekly_min, self.weekly_max],
            "weeks": self.weeks,
            "total_hours": [self.total_min, self.total_max],
            "assumptions": list(self.assumptions),
        }


def planning_budget(context: AgentContext, today: date) -> Budget:
    goal = context.user_context.career_goal
    assumptions: list[str] = []
    weekly: tuple[float, float] | None = None
    if goal and goal.available_hours_per_week:
        weekly = (goal.available_hours_per_week, goal.available_hours_per_week)
    elif goal and goal.weekly_availability:
        weekly = WEEKLY_HOURS[goal.weekly_availability]
        assumptions.append(
            f"Weekly time uses the saved range {weekly[0]:g}-{weekly[1]:g} hours; no exact hours were given."
        )
        if goal.weekly_availability == "hours_10_plus":
            assumptions.append("The 10+ hours band is capped at 15 hours per week for planning.")
    else:
        assumptions.append("No weekly availability is saved; time estimates are not checked against a budget.")

    if goal and goal.target_date and goal.target_date > today:
        weeks = max(1, (goal.target_date - today).days // 7)
        assumptions.append(f"About {weeks} weeks remain until the saved target date {goal.target_date.isoformat()}.")
    elif goal and goal.readiness_timeframe in TIMEFRAME_WEEKS:
        weeks = TIMEFRAME_WEEKS[goal.readiness_timeframe]
        assumptions.append(f"The {goal.readiness_timeframe.replace('_', ' ')} timeframe is planned as {weeks} weeks.")
    else:
        weeks = DEFAULT_HORIZON_WEEKS
        assumptions.append(f"No deadline is saved; the plan covers a {weeks}-week horizon.")

    if weekly is None:
        return Budget(None, None, weeks, None, None, tuple(assumptions))
    return Budget(weekly[0], weekly[1], weeks, round(weekly[0] * weeks), round(weekly[1] * weeks), tuple(assumptions))


def compact_context(context: AgentContext, budget: Budget) -> dict[str, Any]:
    user = context.user_context
    goal = user.career_goal
    excerpts: list[str] = []
    for skill in user.confirmed_skills:
        for item in skill.evidence:
            text = (item.excerpt or "").strip()[:EXCERPT_CHARS]
            if text and text not in excerpts and len(excerpts) < MAX_EXCERPTS:
                excerpts.append(text)

    learning_chunks = {
        entry.chunk_id for entry in context.evidence_registry if "learning_content" in entry.usage_roles
    }
    focus_ids = set(context.replan_trigger.focus_skill_ids) if context.replan_trigger else set()
    return {
        "learner": {
            "background": user.background.model_dump(mode="json"),
            "confirmed_skills": [
                {"skill_id": s.skill_id, "name": s.skill_name, "level": s.proficiency_level,
                 "level_basis": s.proficiency_basis}
                for s in user.confirmed_skills
            ],
            "profile_evidence_excerpts": excerpts,
            "projects": [
                {
                    "title": project.title,
                    "role": project.role,
                    "description": project.description,
                    "highlights": list(project.highlights),
                    "period": {
                        "start": project.start_date.isoformat() if project.start_date else None,
                        "end": project.end_date.isoformat() if project.end_date else None,
                        "current": project.is_current,
                    },
                    "skills": [
                        {"skill_id": skill.skill_id, "name": skill.skill_name}
                        for skill in project.skills
                    ],
                }
                for project in user.projects
            ],
            "projects_truncated": user.projects_truncated,
        },
        "goal": None if goal is None else {
            "target_role": goal.target_role_title,
            "readiness_timeframe": goal.readiness_timeframe,
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "weekly_availability": goal.weekly_availability,
            "preferred_learning_style": goal.preferred_learning_style,
            "learner_note": goal.additional_context,
        },
        "planning_budget": budget.as_dict(),
        "replan_trigger": None if context.replan_trigger is None else {
            "kind": context.replan_trigger.kind,
            "application_id": context.replan_trigger.application_id,
            "job_title": context.replan_trigger.job_title,
            "rejection_category": context.replan_trigger.rejection_category,
            "reason_summary": context.replan_trigger.reason_summary,
            "reason_source": context.replan_trigger.source,
            "is_demo": context.replan_trigger.is_demo,
            "market_window": (None if context.replan_trigger.market_window is None else
                              context.replan_trigger.market_window.model_dump(mode="json")),
            "focus_skill_ids": list(context.replan_trigger.focus_skill_ids),
            "review_skill_ids": list(context.replan_trigger.review_skill_ids),
        },
        "career": {
            "name": context.career_context.career_name,
            "jobs_in_market_sample": context.career_context.total_jobs,
        },
        "main_skills": [
            {
                "skill_id": c.skill_id,
                "name": c.skill_name,
                # Selection order is controlled by the caller. Priority rank is a
                # separate signal and may be null for zero/unknown gaps.
                "rank": rank,
                "priority_rank": c.priority.rank,
                "priority_score": c.priority.priority_score,
                "gap_status": c.gap.status,
                "current_level": c.gap.current_level,
                "target_level": c.gap.target_level,
                "recommendation": c.learning_recommendation,
                "rag_status": c.rag_status,
                "teaching_content": c.teaching_content_status,
                "market": None if c.market is None else {
                    "jobs_mentioning": c.market.demand_count,
                    "required_in": c.market.required_count,
                    "preferred_in": c.market.preferred_count,
                },
                "claims": [
                    {"text": claim.text, "kind": claim.support_kind,
                     "chunk_ids": sorted({cite.chunk_id for cite in claim.citations}),
                     "citations": [{"chunk_id": cite.chunk_id, "quote": cite.quote} for cite in claim.citations]}
                    for claim in c.claims
                ],
                "foundation_skill_ids": list(c.foundation_skill_ids),
            }
            for rank, c in enumerate(sorted(
                (item for item in context.roadmap_candidates
                 if item.learning_recommendation != "reference_only"),
                key=lambda item: (0 if item.skill_id in focus_ids else 1,
                                  context.replan_trigger.focus_skill_ids.index(item.skill_id)
                                  if context.replan_trigger and item.skill_id in focus_ids
                                  else item.priority.rank or 10_000),
            ), 1)
            if c.learning_recommendation != "reference_only"
        ],
        "completed_skills": [
            {
                "skill_id": c.skill_id,
                "name": c.skill_name,
                "gap_status": c.gap.status,
                "current_level": c.gap.current_level,
                "target_level": c.gap.target_level,
                "proficiency_basis": c.proficiency_basis,
                "rank": rank,
                "claims": [
                    {"text": claim.text, "kind": claim.support_kind,
                     "chunk_ids": sorted({cite.chunk_id for cite in claim.citations}),
                     "citations": [{"chunk_id": cite.chunk_id, "quote": cite.quote} for cite in claim.citations]}
                    for claim in c.claims
                ],
                "teaching_content": c.teaching_content_status,
            }
            for rank, c in enumerate(context.roadmap_candidates, 1)
            if c.learning_recommendation == "reference_only"
            and c.gap.status in {"covered", "not_assessed"}
        ],
        "foundations": [
            {
                "skill_id": f.skill_id,
                "name": f.skill_name,
                "in_profile": f.confirmed_in_user_profile,
                "user_level": f.user_level,
                "learning_content": f.learning_content_status,
                "learner_satisfaction": f.learner_satisfaction,
                "relationships": [
                    {"for_skill_id": r.target_skill_id, "type": r.dependency_type,
                     "scope": r.scope_type, "condition": r.scope_note, "applicability": r.applicability,
                     "runtime_role": r.runtime_role,
                     "blocks_unconditional_progress": r.blocks_unconditional_progress}
                    for r in f.relationships
                ],
            }
            for f in context.foundation_mentions
        ],
        "sources": [
            {
                "chunk_id": e.chunk_id,
                "title": e.title,
                "section": " > ".join(e.heading_path),
                "for_skill_ids": list(e.used_by_skill_ids),
                "content": e.content,
            }
            for e in context.evidence_registry
            if e.chunk_id in learning_chunks
        ],
    }


def input_fingerprint(compact: dict[str, Any], *parts: str) -> str:
    """Stable hash of what the model would see; equal hashes can reuse a saved roadmap."""
    payload = json.dumps(compact, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256("\x1f".join([payload, *parts]).encode("utf-8")).hexdigest()
