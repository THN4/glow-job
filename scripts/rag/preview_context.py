"""Preview RAG inputs; no final scores, model calls, or database writes."""

import argparse
import json
from pathlib import Path

from rag.context.repository import load_inputs
from scripts.rag._database import connect


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--career-profile-id", type=int, required=True)
    parser.add_argument("--profile-id", help="Optional saved profile; omit for market-only input")
    parser.add_argument("--date-basis", choices=("posted_at", "first_seen_at"), default="posted_at")
    parser.add_argument("--output", type=Path, help="Write full inputs locally, including evidence excerpts")
    args = parser.parse_args()
    try:
        with connect() as connection:
            inputs = load_inputs(
                connection, career_profile_id=args.career_profile_id,
                profile_id=args.profile_id, date_basis=args.date_basis,
            )
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(inputs.model_dump_json(indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": inputs.status,
            "careerProfileId": inputs.career.career_profile_id,
            "marketSkills": len(inputs.market.skills),
            "confirmedUserSkills": len(inputs.user.confirmed_skills) if inputs.user else None,
            "unresolvedUserSkills": len(inputs.user.unresolved_skills) if inputs.user else None,
            "scorePolicyStatus": inputs.score_policy_status,
            "warnings": inputs.warnings,
            "output": str(args.output) if args.output else None,
        }, indent=2))
        return 0
    except (ValueError, ImportError) as error:
        parser.error(str(error))
    except Exception as error:
        parser.exit(1, f"Input preview failed ({type(error).__name__}); check database connectivity.\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
