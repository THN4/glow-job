"""Build a user's Agent Context directly from saved inputs and document evidence."""

from hashlib import sha256

from rag.context.assemble import assemble_context, score_market
from rag.context.repository import load_inputs

MAX_MAIN_SKILLS = 8
MAX_COMPLETED_SKILLS = 4


class KnowledgeNotReady(ValueError):
    """The selected gaps have no reviewed learning content to plan from."""


def build_agent_context(connection, *, profile_id, career_profile_id, date_basis,
                        min_total_jobs, max_market_age_days, min_level_observations,
                        min_target_level_confidence):
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
    confirmed_skill_ids = {item.skill_id for item in inputs.user.confirmed_skills}
    profile_core = sorted(
        (item for item in assessments
         if item.is_core_skill and item.market.skill_id in confirmed_skill_ids
         and item.gap.status in {"covered", "not_assessed"}),
        key=lambda item: (item.core_rank or 10_000, item.market.skill_id),
    )
    available = coverage(connection, [item.market.skill_id for item in [*ranked_gaps, *profile_core]])
    gaps = [item for item in ranked_gaps
            if (item.market.skill_id in available
                and available[item.market.skill_id]["embedded_chunks"] > 0)][:MAX_MAIN_SKILLS]
    completed = [item for item in profile_core
                 if (item.market.skill_id in available
                     and available[item.market.skill_id]["embedded_chunks"] > 0)][:MAX_COMPLETED_SKILLS]
    selected = [*completed, *gaps]
    if not selected:
        raise KnowledgeNotReady("No confirmed core skills or ranked skill gaps have embedded learning documents")

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
    if not any(skill.teaching_content_status == "available" for skill in knowledge.skills):
        raise KnowledgeNotReady("The selected roadmap skills have no reviewed instructional evidence")
    knowledge = knowledge.model_copy(update={
        "warnings": [
            "Roadmap learning skills are ranked core gaps; up to four confirmed core profile skills are included as completed baselines. A completed baseline means the skill is present in the profile; it does not claim the user meets a market target when their level is unknown.",
            *(warning for warning in knowledge.warnings
              if not warning.startswith("Preview only: main skills were explicitly selected")),
        ],
    })

    raw = knowledge.model_dump_json().encode("utf-8")
    return assemble_context(
        connection, inputs, knowledge, knowledge_sha256=sha256(raw).hexdigest(),
        selection_policy="core-priority-gap-v1", max_registry_chars=80000,
        min_total_jobs=min_total_jobs, max_market_age_days=max_market_age_days,
        min_level_observations=min_level_observations,
        min_target_level_confidence=min_target_level_confidence,
    )
