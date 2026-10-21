"""Prepare selected skills' cited document Context; no Agent or DB writes."""

import argparse
import json
from pathlib import Path

from scripts.rag._database import connect


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def markdown(preview):
    lines = ["# Skill knowledge Context preview", "",
             "Selected main skills only; this is not a generated Roadmap or final Agent Context.",
             "Scores, learner proficiency and prerequisite satisfaction have not been inferred.", ""]
    for skill in preview.skills:
        lines.extend([f"## {skill.skill_name} (ID {skill.skill_id})", "",
                      f"Status: **{skill.status}**; reason: {skill.coverage_reason or '-'}", "",
                      f"Teaching content: **{skill.teaching_content_status}**", "",
                      f"Mapped/embedded chunks: {skill.mapped_chunks}/{skill.embedded_chunks}; "
                      f"retrieved candidates: {skill.retrieved_candidates}; sent for review: {skill.chunks_sent_for_review}.", "",
                      f"Levels: {skill.current_level} → {skill.target_level}", ""])
        if skill.claims:
            lines.extend(["### Learning context supported by retrieved passages", ""])
            for claim in skill.claims:
                lines.extend([f"- [{claim.support_kind}] {claim.text}", ""])
                for citation in claim.citations:
                    chunk = next(chunk for chunk in skill.retrieved_context if chunk.chunk_id == citation.chunk_id)
                    lines.extend([f"  Chunk {chunk.chunk_id}, source {chunk.source_id}: {chunk.source_url or chunk.title}", "",
                                  "\n".join("  > " + line for line in citation.quote.splitlines()), ""])
        if skill.dependencies:
            lines.extend(["### Foundations and related mentions (no separate activity)", ""])
            for dep in skill.dependencies:
                lines.extend([f"- **{dep['skill_name']}**: {dep['dependency_type']} / {dep['scope_type']}; "
                              f"{dep['notice']}",
                              f"  Condition: {dep['scope_note'] or 'general relationship'}; "
                              f"learner satisfaction: {dep['learner_satisfaction']}.",
                              f"  Evidence: source {dep['source_id']}, chunk {dep['chunk_id']} — {dep['source_url']}", ""])
                if dep["blocks_unconditional_progress"]:
                    lines.extend(["  Required foundation needs confirmation before claiming unrestricted progression.", ""])
        for warning in skill.warnings:
            lines.append(f"- Limitation: {warning}")
        lines.append("")
    lines.extend(["## Policy and limitations", "", *[f"- {warning}" for warning in preview.warnings], "",
                  f"Document characters sent for review: {preview.content_chars_sent_for_review}; "
                  f"selected content characters: {preview.selected_content_chars}.", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill", action="append", required=True, help="Explicit main skill canonical name/alias; repeat for up to 8")
    parser.add_argument("--intent", choices=("fundamentals", "level_improvement", "practice"), default="fundamentals")
    levels = ("unknown", "beginner", "intermediate", "advanced", "expert")
    parser.add_argument("--current-level", choices=levels, default="unknown")
    parser.add_argument("--target-level", choices=levels, default="unknown")
    parser.add_argument("--candidate-limit", type=int, default=12)
    parser.add_argument("--selected-limit", type=int, default=5)
    parser.add_argument("--per-skill-chars", type=int, default=16000)
    parser.add_argument("--total-chars", type=int, default=48000)
    parser.add_argument("--min-similarity", type=float, help="Optional experimental cutoff; no calibrated default")
    parser.add_argument("--review", action="store_true", help="Send retrieved public documents to shared Gemini text client for cited context")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.output.suffix.lower() != ".json" or args.output.exists():
            raise ValueError("Choose a new .json output path; existing results are not overwritten")
        # Reuse the pipeline's connection/import boundary; do not duplicate DB settings.
        with connect() as connection:
            from src.documents.retrieval.skill_context import prepare_context, resolve_skills
            from src.documents.schemas.skill_context import ContextRequest, RetrievalPolicy

            selected = resolve_skills(connection, args.skill)
            request = ContextRequest(
                skill_ids=[skill["skill_id"] for skill in selected], intent=args.intent,
                current_level=args.current_level, target_level=args.target_level,
                policy=RetrievalPolicy(candidate_limit=args.candidate_limit, selected_limit=args.selected_limit,
                                       per_skill_chars=args.per_skill_chars, total_chars=args.total_chars,
                                       min_similarity=args.min_similarity),
            )
            raw_dir = args.output.with_suffix(".responses")
            raw_dir.mkdir(parents=True, exist_ok=True)
            partial_path = args.output.with_suffix(".partial.json")
            partial = []

            def save_raw(skill_id, attempt, raw):
                (raw_dir / f"skill-{skill_id}.attempt-{attempt}.json").write_text(raw, encoding="utf-8")

            def completed(skill):
                partial.append(skill.model_dump(mode="json"))
                write_json(partial_path, {"status": "partial_preparation", "request": request.model_dump(), "skills": partial})
                print(json.dumps({"skill": skill.skill_name, "status": skill.status,
                                  "claims": len(skill.claims), "dependency_mentions": len(skill.dependencies),
                                  "coverage_reason": skill.coverage_reason}, ensure_ascii=False), flush=True)

            preview = prepare_context(connection, request, text_review=args.review, save_raw=save_raw, on_skill=completed)
        write_json(args.output, preview.model_dump(mode="json"))
        write_json(args.output.with_suffix(".schema.json"), type(preview).model_json_schema())
        args.output.with_suffix(".md").write_text(markdown(preview), encoding="utf-8")
        print(json.dumps({"status": preview.status, "skills": len(preview.skills),
                          "claims": sum(len(skill.claims) for skill in preview.skills),
                          "errors": sum(skill.status == "error" for skill in preview.skills),
                          "text_review": args.review, "output": str(args.output), "db_writes": 0}, ensure_ascii=False, indent=2))
        return 2 if any(skill.status == "error" for skill in preview.skills) else 0
    except (ValueError, OSError, ImportError) as error:
        parser.error(str(error))
    except KeyboardInterrupt:
        parser.exit(130, "Stopped; completed per-skill checkpoints and raw responses retained.\n")
    except Exception as error:
        parser.exit(1, f"Knowledge preparation failed ({type(error).__name__}); no DB writes.\n")


if __name__ == "__main__":
    raise SystemExit(main())
