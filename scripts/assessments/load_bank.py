"""Load a reviewed question bank JSON into the database (app.assessment_items and statements).

    python -m scripts.assessments.load_bank --file ai/assessments/seed/demo_bank.json --dry-run
    python -m scripts.assessments.load_bank --file ai/assessments/seed/demo_bank.json

Every item is checked first: four distinct options, a question mark, and a quote that is an exact
passage of its knowledge chunk (when the knowledge tables are present). Items that fail are not
loaded. Re-running updates items with the same skill and question text, so it is safe to repeat.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from psycopg.types.json import Jsonb

from ai.assessments.bank import Bank, item_issues


def chunk_texts(connection, chunk_ids: list[int]) -> dict[int, str] | None:
    present = connection.execute("SELECT to_regclass('knowledge.knowledge_chunks') IS NOT NULL").fetchone()[0]
    if not present:
        return None
    rows = connection.execute("SELECT chunk_id, content FROM knowledge.knowledge_chunks WHERE chunk_id = ANY(%s)",
                              (chunk_ids,)).fetchall()
    return dict(rows)


def load(connection, bank: Bank, *, skip_source_check: bool, dry_run: bool) -> dict[str, int]:
    texts = None if skip_source_check else chunk_texts(connection, sorted({i.chunk_id for i in bank.items}))
    skills = {r[0] for r in connection.execute("SELECT skill_id FROM core.skills WHERE skill_id = ANY(%s)", (
        sorted({i.skill_id for i in bank.items} | {s.skill_id for s in bank.statements if s.skill_id}),)).fetchall()}
    counts = {"loaded": 0, "rejected": 0, "statements": 0}
    for item in bank.items:
        issues = item_issues(item, texts.get(item.chunk_id, "") if texts is not None else None)
        if item.skill_id not in skills:
            issues.append(f"Skill {item.skill_id} is not in core.skills.")
        if texts is not None and item.content_hash and item.chunk_id in texts:
            if hashlib.sha256(texts[item.chunk_id].encode("utf-8")).hexdigest() != item.content_hash:
                issues.append("The chunk changed since this item was written. Review it again.")
        if issues:
            counts["rejected"] += 1
            print(f"SKIP  skill {item.skill_id} chunk {item.chunk_id}: {item.stem[:60]} -> {'; '.join(issues)}")
            continue
        counts["loaded"] += 1
        if dry_run:
            continue
        connection.execute(
            """
            INSERT INTO app.assessment_items (skill_id, chunk_id, level, stem, options, answer_index, quote,
                source_title, source_heading, source_url, content_hash, status, generated_by, reviewed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    CASE WHEN %s = 'approved' THEN now() END)
            ON CONFLICT (skill_id, stem) DO UPDATE SET
                chunk_id = EXCLUDED.chunk_id, level = EXCLUDED.level, options = EXCLUDED.options,
                answer_index = EXCLUDED.answer_index, quote = EXCLUDED.quote, source_title = EXCLUDED.source_title,
                source_heading = EXCLUDED.source_heading, source_url = EXCLUDED.source_url,
                content_hash = EXCLUDED.content_hash, status = EXCLUDED.status, generated_by = EXCLUDED.generated_by,
                reviewed_at = EXCLUDED.reviewed_at
            """,
            (item.skill_id, item.chunk_id, item.level, item.stem, Jsonb(item.options), item.answer_index, item.quote,
             item.source_title, item.source_heading, item.source_url, item.content_hash, item.status,
             item.generated_by, item.status),
        )
    for st in bank.statements:
        if st.skill_id is not None and st.skill_id not in skills:
            print(f"SKIP  statement for unknown skill {st.skill_id}")
            continue
        counts["statements"] += 1
        if dry_run:
            continue
        if st.skill_id is None:
            connection.execute(
                """
                INSERT INTO app.assessment_self_check_statements (skill_id, level, position, text)
                VALUES (NULL, %s, %s, %s)
                ON CONFLICT (level, position) WHERE skill_id IS NULL DO UPDATE SET text = EXCLUDED.text
                """, (st.level, st.position, st.text))
        else:
            connection.execute(
                """
                INSERT INTO app.assessment_self_check_statements (skill_id, level, position, text)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (skill_id, level, position) WHERE skill_id IS NOT NULL DO UPDATE SET text = EXCLUDED.text
                """, (st.skill_id, st.level, st.position, st.text))
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true", help="Check everything, write nothing")
    parser.add_argument("--skip-source-check", action="store_true",
                        help="Do not compare quotes with knowledge chunks (test databases without knowledge data)")
    args = parser.parse_args()
    bank = Bank.model_validate_json(args.file.read_bytes())
    from scripts.rag._database import connect

    with connect() as connection:
        with connection.transaction():
            counts = load(connection, bank, skip_source_check=args.skip_source_check, dry_run=args.dry_run)
    print(json.dumps({**counts, "dry_run": args.dry_run}))
    return 1 if counts["rejected"] else 0


if __name__ == "__main__":
    sys.exit(main())
