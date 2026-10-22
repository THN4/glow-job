"""Assemble saved profile/goal/Market and cited knowledge locally for the AI team."""

import argparse
from hashlib import sha256
from pathlib import Path
import json

from rag.context.agent_models import AgentContext
from rag.context.assemble import assemble_context
from rag.context.repository import load_inputs
from scripts.rag._database import connect
from scripts.rag.prepare_skill_context import write_json


def markdown(context):
    lines = ["# Agent Context — local handoff preview", "",
             f"Status: **{context.status}**; schema: `{context.schema_version}`", "",
             f"Career: {context.career_context.profile_name}", "",
             "Saved profile/goal, complete market scoring and cited knowledge are assembled locally; no model calls or DB writes.",
             f"Match policy: `{context.career_context.scores.policy_version}`; Core set: "
             f"{context.career_context.scores.core_skill_policy.included_count}/"
             f"{context.career_context.scores.core_skill_policy.nominal_limit} nominal skills (cutoff ties included).", "",
             "## Career match scores", "",
             "| Metric | Score |", "|---|---:|",
             f"| Core skill match | {context.career_context.scores.metrics.core_skill_match_pct if context.career_context.scores.metrics.core_skill_match_pct is not None else 'N/A'}% |",
             f"| Market skill coverage | {context.career_context.scores.metrics.market_skill_coverage_pct if context.career_context.scores.metrics.market_skill_coverage_pct is not None else 'N/A'}% |",
             f"| Proficiency alignment | {context.career_context.scores.metrics.proficiency_alignment_pct if context.career_context.scores.metrics.proficiency_alignment_pct is not None else 'N/A'}% |",
             f"| Assessment coverage | {context.career_context.scores.metrics.assessment_coverage_pct if context.career_context.scores.metrics.assessment_coverage_pct is not None else 'N/A'}% |",
             "", *[f"- {warning}" for warning in context.career_context.scores.warnings], "",
             "Scores describe confirmed skill presence and observed proficiency alignment against this Market snapshot; they are not hiring probabilities.", "",
             "## RAG selected main skills", "",
             "| Priority rank | Skill | Gap | Gap score | Priority score | Knowledge | Teaching content | Recommendation |",
             "|---:|---|---|---:|---:|---|---|---|"]
    for skill in context.roadmap_candidates:
        rank = skill.priority.rank if skill.priority.rank is not None else "—"
        gap_score = skill.gap.gap_score if skill.gap.gap_score is not None else "—"
        priority_score = skill.priority.priority_score if skill.priority.priority_score is not None else "—"
        lines.append(f"| {rank} | {skill.skill_name} | {skill.gap.status} | {gap_score} | {priority_score} | {skill.rag_status} | {skill.teaching_content_status} | {skill.learning_recommendation} |")
    goal = context.user_context.career_goal
    lines.extend(["", "## Saved goal and constraints", "",
                  f"Target date: {goal.target_date if goal else 'not saved'}",
                  f"Weekly availability: {goal.weekly_availability if goal else 'not saved'}",
                  f"Explicit hours/week: {goal.available_hours_per_week if goal else 'not saved'}",
                  f"Learning preference: {goal.preferred_learning_style if goal else 'not saved'}", "",
                  "Availability ranges are preserved; no midpoint or learning duration has been invented.", ""])
    for skill in context.roadmap_candidates:
        lines.extend([f"## {skill.skill_name}", "", f"Gap reason: {skill.gap.reason_code}", "",
                      f"Observed levels: {skill.gap.current_level} → {skill.gap.target_level}; gap score: {skill.gap.gap_score}; "
                      f"priority score: {skill.priority.priority_score}; confirmation required: {skill.gap.requires_confirmation}.", ""])
        for claim in skill.claims:
            lines.extend([f"- [{claim.support_kind}] {claim.text}", ""])
            for citation in claim.citations:
                entry = next(entry for entry in context.evidence_registry if entry.chunk_id == citation.chunk_id)
                lines.extend([f"  Source {entry.source_id}, chunk {entry.chunk_id}: {entry.source_url}", "",
                              "\n".join("  > " + line for line in citation.quote.splitlines()), ""])
    lines.extend(["## Foundation and related mentions (grouped by canonical ID)", ""])
    for item in context.foundation_mentions:
        lines.extend([f"- **{item.skill_name}**: {item.notice}",
                      f"  In confirmed profile: {item.confirmed_in_user_profile}; level: {item.user_level}; "
                      f"prerequisite satisfaction: {item.learner_satisfaction}.", ""])
        for relationship in item.relationships:
            lines.append(f"  - For main skill {relationship.target_skill_id}: {relationship.dependency_type}; "
                         f"{relationship.scope_type}; condition: {relationship.scope_note or 'general'}; "
                         f"evidence chunk {relationship.chunk_id}.")
        lines.append("")
    lines.extend(["## Evidence registry and limitations", "",
                  f"Unique chunks: {len(context.evidence_registry)}; "
                  f"document characters: {sum(len(entry.content) for entry in context.evidence_registry)}.", "",
                  f"Market skill assessments: {len(context.market_skill_assessments)}; "
                  f"core eligible: {context.career_context.scores.core_skill_policy.eligible_skill_count}; "
                  f"excluded from score denominator: {context.career_context.scores.core_skill_policy.excluded_skill_count}.", "",
                  *[f"- {warning}" for warning in context.warnings], ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile-id", required=True, help="Saved profile authorized for local inspection")
    parser.add_argument("--career-profile-id", type=int, required=True)
    parser.add_argument("--date-basis", choices=("posted_at", "first_seen_at"), default="first_seen_at")
    parser.add_argument("--knowledge", type=Path, required=True, help="Saved validated knowledge-context-preview-1 JSON; defines explicit mains")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-registry-chars", type=int, default=40000)
    parser.add_argument("--max-payload-chars", type=int, default=500000,
                        help="Maximum serialized Agent Context size in characters")
    args = parser.parse_args()
    try:
        if not args.profile_id.strip() or args.career_profile_id < 1:
            raise ValueError("Supply a profile ID and positive career profile ID")
        if args.output.suffix.lower() != ".json" or args.output.exists():
            raise ValueError("Choose a new JSON output path")
        raw = args.knowledge.read_bytes()
        with connect() as connection:
            from src.documents.schemas.skill_context import KnowledgeContextPreview
            knowledge = KnowledgeContextPreview.model_validate_json(raw)
            inputs = load_inputs(connection, career_profile_id=args.career_profile_id,
                                 profile_id=args.profile_id, date_basis=args.date_basis)
            context = assemble_context(connection, inputs, knowledge, knowledge_sha256=sha256(raw).hexdigest(),
                                       max_registry_chars=args.max_registry_chars, max_payload_chars=args.max_payload_chars)
        write_json(args.output, context.model_dump(mode="json"))
        write_json(args.output.with_suffix(".schema.json"), AgentContext.model_json_schema())
        args.output.with_suffix(".md").write_text(markdown(context), encoding="utf-8")
        print(json.dumps({"status": context.status, "main_skills": len(context.roadmap_candidates),
                          "career_scores": context.career_context.scores.metrics.model_dump(),
                          "core_skill_policy": context.career_context.scores.core_skill_policy.model_dump(),
                          "market_skill_assessments": len(context.market_skill_assessments),
                          "foundation_mentions": len(context.foundation_mentions),
                          "unique_evidence_chunks": len(context.evidence_registry),
                          "selected_gaps": context.selected_skill_gap_summary.model_dump(),
                          "market_gaps": context.skill_gap_summary.model_dump(),
                          "model_calls": 0, "db_writes": 0, "output": str(args.output)}, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, ImportError) as error:
        parser.error(str(error))
    except Exception as error:
        parser.exit(1, f"Agent Context assembly failed ({type(error).__name__}); no DB writes or model calls.\n")


if __name__ == "__main__":
    raise SystemExit(main())
