"""Export questions waiting for review (by default the on-demand ``provisional`` ones) to a bank file.

    python -m scripts.assessments.export_review --output rag/data/assessments/review-2026-10-23.json
    python -m scripts.assessments.export_review --skill-id 103 --status provisional --output ...

Review the file like a Gemini draft: the answer must follow from the quote and wrong options must be
clearly wrong. Set "status" to "approved" or "rejected" (or fix the wording), then load it back with
python -m scripts.assessments.load_bank --file <the same file>. Items are matched by skill and question
text, so a reworded question is added as a new item. Reject the old wording in the same file.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ai.assessments.bank import Bank, BankItem


def export(connection, status: str, skill_id: int | None) -> Bank:
    rows = connection.execute(
        """
        SELECT skill_id, chunk_id, level, stem, options, answer_index, quote, source_title, source_heading,
               source_url, content_hash, status, generated_by
        FROM app.assessment_items
        WHERE status = %s AND (%s::bigint IS NULL OR skill_id = %s)
        ORDER BY skill_id, chunk_id, item_id
        """,
        (status, skill_id, skill_id),
    ).fetchall()
    keys = ["skill_id", "chunk_id", "level", "stem", "options", "answer_index", "quote", "source_title",
            "source_heading", "source_url", "content_hash", "status", "generated_by"]
    return Bank(items=[BankItem(**dict(zip(keys, r))) for r in rows])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--status", default="provisional", choices=["provisional", "draft", "approved"])
    parser.add_argument("--skill-id", type=int)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("choose a new output file; an existing one may hold review decisions")
    from scripts.rag._database import connect

    with connect() as connection:
        bank = export(connection, args.status, args.skill_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(bank.model_dump_json(indent=2), encoding="utf-8")
    print(f"Exported {len(bank.items)} {args.status} questions to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
