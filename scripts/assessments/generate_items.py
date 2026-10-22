"""Draft single-answer questions for one skill from its knowledge chunks, with Gemini.

    python -m scripts.assessments.generate_items --skill-id 103 --output rag/data/assessments/bank-103.json --allow-model-calls
    python -m scripts.assessments.generate_items --skill-id 103 --chunk-ids 20 42 --output ... --allow-model-calls

Chunks that already have questions (draft files excluded) are skipped, so the model only writes
for chunks with nothing yet. --chunk-ids targets the chunks a roadmap's study tasks cite.
--per-level N asks for the level the skill is shortest of (a level check needs 3 approved per level).

Steps for every chosen chunk (largest first, up to --max-chunks):
1. Gemini writes up to two questions, each with four options, the answer, a level and the exact
   sentence from the chunk that supports the answer.
2. Code checks each question (options, question mark, quote is really in the chunk).
3. Gemini answers each question again without seeing the answer key. A different answer is
   flagged as possibly ambiguous.

The output is a draft bank (status "draft"). A reviewer looks at flagged items, sets "status"
to "approved" or "rejected", then loads the file with scripts.assessments.load_bank.
No user data is sent. Only public document chunks and the skill name.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Callable

from ai.assessments.bank import Bank, normalize
from ai.assessments.generate import blind_check, draft_items
from ai.assessments.scoring import LEVELS
from scripts.rag._database import connect

def chunks_for_skill(connection, skill_id: int, limit: int, chunk_ids: list[int] | None = None,
                     skip_existing: bool = True) -> list[dict]:
    rows = connection.execute(
        """
        SELECT c.chunk_id, c.content, s.source_url,
               COALESCE(NULLIF(c.metadata->>'page_title', ''), s.title) AS title,
               c.metadata->'heading_path' AS heading_path
        FROM knowledge.knowledge_chunk_skills AS m
        JOIN knowledge.knowledge_chunks AS c USING (chunk_id)
        JOIN knowledge.knowledge_sources AS s USING (source_id)
        WHERE m.skill_id = %s AND s.is_active
          AND (%s::bigint[] IS NULL OR c.chunk_id = ANY(%s::bigint[]))
          AND (NOT %s OR NOT EXISTS (SELECT 1 FROM app.assessment_items AS i WHERE i.chunk_id = c.chunk_id
                                      AND i.status IN ('provisional', 'approved')))
        ORDER BY length(c.content) DESC, c.chunk_id
        LIMIT %s
        """,
        (skill_id, chunk_ids, chunk_ids, skip_existing, limit),
    ).fetchall()
    return [{"chunk_id": r[0], "content": r[1], "url": r[2], "title": r[3],
             "heading": (r[4] or [None])[-1] if isinstance(r[4], list) else None} for r in rows]


def main(generate: Callable[[str], str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skill-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-chunks", type=int, default=12)
    parser.add_argument("--chunk-ids", type=int, nargs="+", help="only these chunks (for example the ones a roadmap cites)")
    parser.add_argument("--include-existing", action="store_true", help="also write for chunks that have questions")
    parser.add_argument("--per-level", type=int, default=0, help="steer levels toward N approved questions each")
    parser.add_argument("--allow-model-calls", action="store_true", help="Required: this calls Gemini")
    args = parser.parse_args()
    if not args.allow_model_calls and generate is None:
        parser.error("this calls Gemini; add --allow-model-calls to confirm")
    if args.output.exists():
        parser.error("choose a new output file; existing drafts may hold review decisions")
    with connect() as connection:  # also puts data-pipeline on sys.path for the Gemini client
        name = connection.execute("SELECT skill_name FROM core.skills WHERE skill_id = %s", (args.skill_id,)).fetchone()
        if name is None:
            parser.error(f"skill {args.skill_id} not found")
        chunks = chunks_for_skill(connection, args.skill_id, args.max_chunks, args.chunk_ids,
                                  not args.include_existing)
        stems = {normalize(r[0]).lower() for r in connection.execute(
            "SELECT stem FROM app.assessment_items WHERE skill_id = %s", (args.skill_id,)).fetchall()}
        have = dict(connection.execute(
            "SELECT level, count(*) FROM app.assessment_items WHERE skill_id = %s AND status = 'approved' "
            "GROUP BY level", (args.skill_id,)).fetchall())
    if generate is None:
        from src.shared.llm.gemini_client import gemini_generate as generate
    if not chunks:
        print("No knowledge chunks without questions are mapped to this skill (see --include-existing).")
        return 1
    level_for = None
    if args.per_level:
        planned = {lvl: have.get(lvl, 0) for lvl in LEVELS}

        def level_for(_chunk: dict) -> str | None:
            short = min(LEVELS, key=lambda lvl: planned[lvl])
            if planned[short] >= args.per_level:
                return None
            planned[short] += 2  # up to two questions per chunk
            return short
    items = draft_items(args.skill_id, name[0], chunks, generate, level_for=level_for)
    duplicates = [i for i in items if normalize(i.stem).lower() in stems]
    items = [i for i in items if normalize(i.stem).lower() not in stems]
    if duplicates:
        print(f"Dropped {len(duplicates)} questions already in the bank")
    blind_check(items, name[0], generate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(Bank(items=items).model_dump_json(indent=2), encoding="utf-8")
    flagged = sum(bool(i.flags) for i in items)
    print(json.dumps({"skill": name[0], "chunks": len(chunks), "drafted": len(items), "flagged": flagged,
                      "levels": {lvl: sum(i.level == lvl for i in items) for lvl in ("beginner", "intermediate", "advanced")},
                      "output": str(args.output)}))
    print("Next: review the file (look at flagged items first), set status to approved or rejected, then run "
          "python -m scripts.assessments.load_bank --file " + str(args.output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
