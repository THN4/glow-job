"""Generate a roadmap from a saved Agent Context JSON file, without the backend or database.

Free (mock provider):
    python -m ai.roadmap.cli --context ai/roadmap/fixtures/agent-context-demo-student.json --output out.json

Gemini calls need --allow-spend so a real model call is never made by accident:
    python -m ai.roadmap.cli --context ... --output ... --provider gemini --allow-spend
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

from ai.roadmap.cost import pricing_for_model
from ai.roadmap.generate import GenerationFailed, generate_roadmap, prepare
from ai.roadmap.providers import create_model
from rag.context.agent_models import AgentContext


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="Where to write the RoadmapView JSON")
    parser.add_argument("--provider", choices=("mock", "gemini", "anthropic", "bedrock", "bedrock_converse"), default="mock")
    parser.add_argument("--model", help="Override the model ID")
    parser.add_argument("--aws-region", default=os.getenv("ROADMAP_AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION"),
                        help="AWS region for Bedrock (defaults to process environment)")
    parser.add_argument("--input-price", type=float, default=os.getenv("ROADMAP_PRICE_INPUT_PER_MTOK") or None)
    parser.add_argument("--output-price", type=float, default=os.getenv("ROADMAP_PRICE_OUTPUT_PER_MTOK") or None)
    parser.add_argument("--effort", choices=("low", "medium", "high", "xhigh", "max"), default="medium")
    parser.add_argument("--max-tokens", type=int, default=24000)
    parser.add_argument("--today", type=date.fromisoformat, help="Planning date, for reproducible runs")
    parser.add_argument("--allow-spend", action="store_true", help="Required for non-mock providers")
    parser.add_argument("--save-draft", action="store_true", help="Also write the raw model draft")
    args = parser.parse_args()

    if args.provider != "mock" and not args.allow_spend:
        parser.error("this provider calls a paid model; add --allow-spend to confirm")
    if args.output.suffix.lower() != ".json":
        parser.error("--output must be a .json path")

    context = AgentContext.model_validate_json(args.context.read_bytes())
    model_id = args.model
    if not model_id and args.provider == "bedrock_converse":
        model_id = os.getenv("BEDROCK_ROADMAP_MODEL") or "us.amazon.nova-2-lite-v1:0"
    pricing = pricing_for_model(args.provider, model_id, input_price=args.input_price, output_price=args.output_price)
    model = create_model(args.provider, model_id=model_id, aws_region=args.aws_region,
                         effort=args.effort, max_tokens=args.max_tokens)
    prepared = prepare(context, model, today=args.today, effort=args.effort)
    print(f"Context characters sent to the model: {len(json.dumps(prepared.compact, ensure_ascii=False)):,} "
          f"(full Agent Context: {len(args.context.read_text(encoding='utf-8')):,})")
    try:
        result = generate_roadmap(context, model, prepared=prepared, pricing=pricing)
    except GenerationFailed as err:
        print(json.dumps({"error": err.code, "message": err.message, "issues": err.issues,
                          "usage": err.usage.as_dict(), "estimated_cost_usd": err.cost_usd}, indent=2))
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(result.view.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
    if args.save_draft:
        args.output.with_suffix(".draft.json").write_text(result.draft.model_dump_json(indent=2), encoding="utf-8")
    print(json.dumps({
        "provider": model.provider, "model": model.model_id,
        "steps": [f"{n.key} ({n.kind}, {n.estimated_hours.min:g}-{n.estimated_hours.max:g} h)"
                  for n in result.view.nodes if n.estimated_hours],
        "deferred": [f"{d.skill_name}: {d.reason_code}" for d in result.view.deferred],
        "estimated_hours": result.view.summary.estimated_hours.model_dump(),
        "budget_hours": result.view.summary.budget_hours.model_dump() if result.view.summary.budget_hours else None,
        "validation_warnings": result.warnings,
        "usage": result.usage.as_dict(), "estimated_cost_usd": result.cost_usd,
        "output": str(args.output),
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
