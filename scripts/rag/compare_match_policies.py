"""Compare saved/synthetic profile coverage; never change the live score policy."""

import argparse
from decimal import Decimal
import json
from pathlib import Path

from rag.context.models import ContextInputs
from rag.context.repository import load_inputs
from rag.context.scoring_experiment import compare_policies, format_report
from scripts.rag._database import connect


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Previously exported ContextInputs JSON")
    source.add_argument("--career-profile-id", type=int, help="Read the selected market snapshot")
    parser.add_argument("--profile-id", help="Saved confirmed profile to compare; requires --career-profile-id")
    parser.add_argument("--date-basis", choices=("posted_at", "first_seen_at"), default="posted_at")
    parser.add_argument("--top-count", type=int, default=10)
    parser.add_argument("--cumulative-share", type=Decimal, default=Decimal("0.80"))
    parser.add_argument("--output", required=True, type=Path, help="Markdown comparison report")
    parser.add_argument("--json-output", type=Path, help="Optional machine-readable results")
    args = parser.parse_args()
    if args.input and args.profile_id is not None:
        parser.error("--profile-id requires --career-profile-id; --input already contains its own profile")
    if args.profile_id is not None and not args.profile_id.strip():
        parser.error("--profile-id must not be blank")
    try:
        if args.input:
            inputs = ContextInputs.model_validate_json(args.input.read_text(encoding="utf-8"))
        else:
            with connect() as connection:
                inputs = load_inputs(
                    connection, career_profile_id=args.career_profile_id, date_basis=args.date_basis,
                    profile_id=args.profile_id,
                )
        report = compare_policies(inputs, top_count=args.top_count, cumulative_share=args.cumulative_share)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(format_report(report), encoding="utf-8")
        if args.json_output:
            args.json_output.parent.mkdir(parents=True, exist_ok=True)
            args.json_output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": report["status"], "careerProfileId": inputs.career.career_profile_id,
            "marketSkills": report["market_skills"], "scenarios": len(report["scenarios"]),
            "policies": len(report["policies"]), "output": str(args.output),
            "savedProfile": report["saved_profile"],
        }, indent=2))
        return 0
    except (ValueError, OSError, ImportError) as error:
        parser.error(str(error))
    except Exception as error:
        parser.exit(1, f"Comparison failed ({type(error).__name__}); check database connectivity.\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
