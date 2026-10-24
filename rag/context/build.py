"""Build a user's Agent Context directly from saved inputs and document evidence."""

from hashlib import sha256

from rag.context.agent_models import AgentContext
from rag.context.assemble import assemble_context, score_market
from rag.context.repository import load_inputs

MAX_MAIN_SKILLS = 8
MAX_COMPLETED_SKILLS = 4


class KnowledgeNotReady(ValueError):
    """No eligible skills are available to include in a roadmap context."""


def build_agent_context(connection, *, profile_id, career_profile_id, date_basis,
                        min_total_jobs, max_market_age_days, min_level_observations,
                        min_target_level_confidence, replan_trigger=None):
    """Select scored core gaps, retrieve cited knowledge, then assemble once.

    The profile must already have been authorized by the calling API. No local
    knowledge or Agent Context file is read or written by this flow.
    """
    from src.documents.retrieval.skill_context import coverage, prepare_context
    from src.documents.schemas.skill_context import ContextRequest, RetrievalPolicy

    inputs = load_inputs(connection, career_profile_id=career_profile_id,
                         profile_id=profile_id, date_basis=date_basis)
    if inputs.user is None or inputs.user.goal is None:
        raise ValueError("A saved profile and career goal are required")

    assessments, _ = score_market(
        inputs, inputs.user.confirmed_skills, min_total_jobs=min_total_jobs,
        max_market_age_days=max_market_age_days,
        min_level_observations=min_level_observations,
        min_target_level_confidence=min_target_level_confidence,
    )
    ranked_gaps = sorted(
        (item for item in assessments if item.priority_rank is not None
         and item.gap.status in {"missing_from_profile", "proficiency_gap"}),
        key=lambda item: item.priority_rank,
    )
    focus_ids = tuple(replan_trigger.focus_skill_ids) if replan_trigger else ()
    confirmed_skill_ids = {item.skill_id for item in inputs.user.confirmed_skills}
    eligible_by_id = {item.market.skill_id: item for item in assessments
                      if item.gap.status in {"missing_from_profile", "proficiency_gap"}
                      or (item.market.skill_id in confirmed_skill_ids
                          and item.gap.status in {"covered", "not_assessed"})}
    if any(skill_id not in eligible_by_id for skill_id in focus_ids):
        raise ValueError("A selected rejection skill is no longer eligible for review")
    profile_core = sorted(
        (item for item in assessments
         if item.is_core_skill and item.market.skill_id in confirmed_skill_ids
         and item.gap.status in {"covered", "not_assessed"}),
        key=lambda item: (item.core_rank or 10_000, item.market.skill_id),
    )
    available = coverage(connection, [item.market.skill_id for item in [*ranked_gaps, *profile_core]])
    focused = [eligible_by_id[skill_id] for skill_id in focus_ids]
    # Keep eligible skills even when their knowledge is not embedded yet.
    # The roadmap renderer marks those nodes as unavailable/blurred; filtering
    # them here would silently remove them before that fallback can run.
    remaining = [item for item in ranked_gaps if item.market.skill_id not in focus_ids
                 and item.market.skill_id in available]
    gaps = (focused + remaining)[:MAX_MAIN_SKILLS]
    completed = [item for item in profile_core if item.market.skill_id not in focus_ids
                 if item.market.skill_id in available][:MAX_COMPLETED_SKILLS]
    selected = [*completed, *gaps]
    if not selected:
        raise KnowledgeNotReady("No eligible confirmed skills or ranked skill gaps are available for this roadmap")

    retrieval_policy = RetrievalPolicy(total_chars=32000, per_skill_chars=8000)
    knowledge_parts = []
    for group in (completed, gaps):
        skill_ids = [item.market.skill_id for item in group]
        if not skill_ids:
            continue
        request = ContextRequest(skill_ids=skill_ids, intent="fundamentals", policy=retrieval_policy)
        knowledge_parts.append(prepare_context(connection, request, text_review=True))
    first = knowledge_parts[0]
    knowledge = first.model_copy(update={
        "skills": [skill for part in knowledge_parts for skill in part.skills],
        "policy": RetrievalPolicy(total_chars=32000 * len(knowledge_parts), per_skill_chars=8000),
        "warnings": list(dict.fromkeys(warning for part in knowledge_parts for warning in part.warnings)),
        "content_chars_sent_for_review": sum(part.content_chars_sent_for_review for part in knowledge_parts),
        "selected_content_chars": sum(part.selected_content_chars for part in knowledge_parts),
    })
    knowledge = knowledge.model_copy(update={
        "warnings": [
            "Roadmap learning skills are ranked core gaps; up to four confirmed core profile skills are included as completed baselines. A completed baseline means the skill is present in the profile; it does not claim the user meets a market target when their level is unknown.",
            *(warning for warning in knowledge.warnings
              if not warning.startswith("Preview only: main skills were explicitly selected")),
        ],
    })

    raw = knowledge.model_dump_json().encode("utf-8")
    context = assemble_context(
        connection, inputs, knowledge, knowledge_sha256=sha256(raw).hexdigest(),
        selection_policy=(f"{replan_trigger.kind.replace('_', '-')}-focus-then-core-priority-v1"
                          if replan_trigger else "core-priority-gap-v1"),
        max_registry_chars=80000,
        min_total_jobs=min_total_jobs, max_market_age_days=max_market_age_days,
        min_level_observations=min_level_observations,
        min_target_level_confidence=min_target_level_confidence,
    )
    candidates = []
    for candidate in context.roadmap_candidates:
        if candidate.skill_id in focus_ids and candidate.learning_recommendation == "reference_only":
            supported = (candidate.teaching_content_status == "available"
                         and candidate.rag_status in {"supported", "partial"})
            candidate = candidate.model_copy(update={
                "learning_recommendation": "candidate" if supported else "needs_confirmation",
            })
        candidates.append(candidate)
    return AgentContext.model_validate_json(context.model_copy(update={
        "roadmap_candidates": tuple(candidates), "replan_trigger": replan_trigger,
    }).model_dump_json())


def extend_agent_context(connection, previous, *, profile_id, career_profile_id,
                         date_basis, replan_trigger, min_total_jobs,
                         max_market_age_days, min_level_observations,
                         min_target_level_confidence):
    """Reuse a saved context and retrieve/assemble evidence only for selected skills.

    User, career, market assessments, scores and already reviewed skills stay as in
    the active roadmap snapshot. The live profile is read only because retrieval and
    evidence validation require current canonical skill/source records.
    """
    from rag.context.assemble import assemble_context, summarize
    from rag.context.repository import load_inputs
    from rag.context.agent_models import Priority
    from src.documents.retrieval.skill_context import prepare_context
    from src.documents.schemas.skill_context import ContextRequest, RetrievalPolicy

    if (previous.user_context.career_goal is None
            or previous.user_context.career_goal.career_profile_id != career_profile_id):
        raise ValueError("The saved roadmap context does not match the selected career goal")

    inputs = load_inputs(connection, career_profile_id=career_profile_id,
                         profile_id=profile_id, date_basis=date_basis)
    if inputs.user is None or inputs.user.goal is None:
        raise ValueError("A saved profile and career goal are required")
    if inputs.market.window != previous.career_context.market_window:
        raise ValueError("The market snapshot changed; review the alert again before re-planning")

    assessments = {item.market.skill_id: item for item in previous.market_skill_assessments}
    focus_ids = tuple(replan_trigger.focus_skill_ids)
    if any(skill_id not in assessments for skill_id in focus_ids):
        raise ValueError("A selected skill is not in the saved career market snapshot")

    user_skills = {item.skill_id: item for item in previous.user_context.confirmed_skills}
    new_candidates = []
    appended = None
    raw = None
    selected_not_in_context = [skill_id for skill_id in focus_ids
                               if skill_id not in {item.skill_id for item in previous.roadmap_candidates}]
    if selected_not_in_context:
        policy = RetrievalPolicy(total_chars=32000, per_skill_chars=8000)
        knowledge = prepare_context(
            connection,
            ContextRequest(skill_ids=selected_not_in_context, intent="fundamentals", policy=policy),
            text_review=True,
        )
        raw = knowledge.model_dump_json().encode("utf-8")
        appended = assemble_context(
            connection, inputs, knowledge, knowledge_sha256=sha256(raw).hexdigest(),
            selection_policy="market-update-selected-skill-extension-v1",
            max_registry_chars=80000, min_total_jobs=min_total_jobs,
            max_market_age_days=max_market_age_days,
            min_level_observations=min_level_observations,
            min_target_level_confidence=min_target_level_confidence,
        )
        for candidate in appended.roadmap_candidates:
            assessment = assessments[candidate.skill_id]
            old_user_skill = user_skills.get(candidate.skill_id)
            reasons = list(candidate.priority.reasons)
            if assessment.priority_rank is not None:
                rank_reason = f"CORE_GAP_PRIORITY_RANK_{assessment.priority_rank}"
                if rank_reason not in reasons:
                    reasons.append(rank_reason)
            candidate = candidate.model_copy(update={
                "gap": assessment.gap,
                "market": assessment.market,
                "proficiency_basis": old_user_skill.proficiency_basis if old_user_skill else None,
                "priority": Priority(
                    rank=assessment.priority_rank,
                    priority_score=assessment.priority_score,
                    reasons=tuple(reasons),
                ),
            })
            new_candidates.append(candidate)

    candidate_by_id = {item.skill_id: item for item in previous.roadmap_candidates}
    candidate_by_id.update({item.skill_id: item for item in new_candidates})
    candidates = list(candidate_by_id.values())
    focus_order = {skill_id: index for index, skill_id in enumerate(focus_ids)}
    candidates.sort(key=lambda item: (
        0 if item.skill_id in focus_order else 1,
        focus_order.get(item.skill_id, 0),
        item.priority.rank or 10_000,
        item.skill_id,
    ))

    registry_by_id = {item.chunk_id: item for item in previous.evidence_registry}
    for entry in (appended.evidence_registry if appended else ()):
        existing = registry_by_id.get(entry.chunk_id)
        if existing is None:
            registry_by_id[entry.chunk_id] = entry
            continue
        if existing.content_hash != entry.content_hash:
            raise ValueError("A saved evidence chunk changed; regenerate the base roadmap before re-planning")
        registry_by_id[entry.chunk_id] = existing.model_copy(update={
            "usage_roles": tuple(sorted(set(existing.usage_roles) | set(entry.usage_roles))),
            "used_by_skill_ids": tuple(sorted(set(existing.used_by_skill_ids) | set(entry.used_by_skill_ids))),
        })

    foundations_by_id = {item.skill_id: item for item in previous.foundation_mentions}
    for foundation in (appended.foundation_mentions if appended else ()):
        existing = foundations_by_id.get(foundation.skill_id)
        if existing is None:
            foundations_by_id[foundation.skill_id] = foundation
            continue
        links = {item.dependency_id: item for item in existing.relationships}
        links.update({item.dependency_id: item for item in foundation.relationships})
        foundations_by_id[foundation.skill_id] = existing.model_copy(update={
            "relationships": tuple(links.values()),
        })

    snapshot = previous.model_dump(mode="json")
    snapshot.pop("context_id", None)
    snapshot.pop("generated_at", None)
    snapshot["roadmap_candidates"] = [item.model_dump(mode="json") for item in candidates]
    snapshot["evidence_registry"] = [item.model_dump(mode="json") for item in registry_by_id.values()]
    snapshot["foundation_mentions"] = [item.model_dump(mode="json") for item in foundations_by_id.values()]
    snapshot["selected_skill_gap_summary"] = summarize([item.gap for item in candidates]).model_dump(mode="json")
    snapshot["replan_trigger"] = replan_trigger.model_dump(mode="json")
    snapshot["policy_versions"]["candidate_selection"] = "market-update-selected-skill-extension-v1"
    snapshot["provenance"]["replan_base_context_id"] = previous.context_id
    if raw is not None:
        snapshot["provenance"]["market_update_knowledge_sha256"] = sha256(raw).hexdigest()
    snapshot["warnings"] = list(dict.fromkeys([
        *snapshot["warnings"],
        "Market re-plan extended the active Agent Context; only the selected skill knowledge was retrieved again.",
    ]))
    return AgentContext.model_validate(snapshot)
