"""On-demand questions for step checks (option C in docs/assessments/question-bank.md).

When a study task cites a chunk with no usable question, a model drafts questions from that chunk
while the learner waits. They pass the same code checks as offline drafts plus a strict blind
check (any disagreement drops the question), and are stored as ``provisional`` so every later
learner reuses them. Reviewers later approve or reject them. Level checks never use them.

Guards: one run per chunk at a time (advisory lock), a daily cap on runs, no retry for a week after
a run produced nothing or for an hour after it failed, and a time limit on the wait. Only public
chunk text and the skill name are sent to the model.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

import psycopg
from psycopg.types.json import Jsonb

from ai.assessments.generate import draft_items, keep_agreed
from app.features.resume.config import CvSettings

log = logging.getLogger(__name__)
LOCK_NAMESPACE = 7301  # pg_advisory_lock(namespace, chunk_id)
GENERATED_BY = "gemini-on-demand"
STEP_MAX_CHUNKS = 4
SKILL_MAX_CHUNKS = 2
USABLE = ("approved", "provisional")


def gemini_generate(api_key: str, timeout_s: float) -> tuple[Callable[[str], str], str]:
    """A JSON-mode Gemini call with the model shared with the data pipeline."""
    from src.shared.llm.gemini_client import GEMINI_MODEL, create_gemini_client

    def generate(prompt: str) -> str:
        with create_gemini_client(api_key=api_key, timeout_ms=int(timeout_s * 1000)) as client:
            response = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt, config={"response_mime_type": "application/json"})
            return response.text or ""

    return generate, GEMINI_MODEL


class QuestionGenerator:
    def __init__(self, settings: CvSettings, generate: Callable[[str], str], *, model: str,
                 daily_limit: int, timeout_s: float):
        self._settings = settings
        self._generate = generate
        self.model = model
        self.daily_limit = daily_limit
        self.timeout_s = timeout_s
        self._background: set[asyncio.Task] = set()

    def _connect(self) -> psycopg.Connection[Any]:
        s = self._settings
        return psycopg.connect(host=s.DB_HOST, port=s.DB_PORT, dbname=s.DB_NAME, user=s.DB_USER,
                               password=s.DB_PASSWORD, connect_timeout=5, autocommit=True)

    # ------------------------------------------------------------------ entry points

    async def fill(self, skill_id: int | None, chunk_ids: list[int], trigger: str = "step_check") -> int:
        """Draft questions for the chunks that have none, waiting at most ``timeout_s``. Returns items made."""
        chunk_ids = list(dict.fromkeys(chunk_ids))[:STEP_MAX_CHUNKS]
        if not chunk_ids:
            return 0
        runs = [asyncio.to_thread(self.fill_chunk, chunk_id, skill_id, trigger) for chunk_id in chunk_ids]
        try:
            made = await asyncio.wait_for(asyncio.gather(*runs, return_exceptions=True), self.timeout_s)
        except TimeoutError:
            # The threads keep going and save their questions for the next learner.
            log.warning("Question generation for chunks %s passed %.0fs", chunk_ids, self.timeout_s)
            return 0
        for result in made:
            if isinstance(result, BaseException):
                log.warning("Question generation failed: %s", result)
        return sum(r for r in made if isinstance(r, int))

    def schedule_skill(self, skill_id: int) -> None:
        """Draft a few questions for a skill in the background (a level check found too few)."""
        task = asyncio.create_task(self._fill_skill(skill_id))
        self._background.add(task)
        task.add_done_callback(self._background.discard)

    async def _fill_skill(self, skill_id: int) -> None:
        try:
            chunks = await asyncio.to_thread(self.open_chunks, skill_id, SKILL_MAX_CHUNKS)
            for chunk_id in chunks:
                await asyncio.to_thread(self.fill_chunk, chunk_id, skill_id, "level_check")
        except Exception:  # background work must not crash the server
            log.exception("Background question generation for skill %s failed", skill_id)

    # ------------------------------------------------------------------ one chunk (runs in a thread)

    def fill_chunk(self, chunk_id: int, skill_id: int | None, trigger: str) -> int:
        with self._connect() as c:
            c.execute("SET lock_timeout = '30s'")
            c.execute("SELECT pg_advisory_lock(%s, %s)", (LOCK_NAMESPACE, chunk_id))
            try:
                return self._fill_locked(c, chunk_id, skill_id, trigger)
            finally:
                c.execute("SELECT pg_advisory_unlock(%s, %s)", (LOCK_NAMESPACE, chunk_id))

    def _fill_locked(self, c: psycopg.Connection[Any], chunk_id: int, skill_id: int | None, trigger: str) -> int:
        if c.execute("SELECT 1 FROM app.assessment_items WHERE chunk_id = %s AND status = ANY(%s) LIMIT 1",
                     (chunk_id, list(USABLE))).fetchone():
            return 0  # another request made them while this one waited for the lock
        if c.execute(
            """
            SELECT 1 FROM app.assessment_generations WHERE chunk_id = %s AND (
                outcome = 'running' AND started_at > now() - interval '10 minutes'
                OR outcome = 'empty' AND started_at > now() - interval '7 days'
                OR outcome = 'failed' AND started_at > now() - interval '1 hour')
            LIMIT 1
            """,
            (chunk_id,),
        ).fetchone():
            return 0
        chunk = self._chunk(c, chunk_id, skill_id)
        if chunk is None:
            return 0
        row = c.execute(
            """
            INSERT INTO app.assessment_generations (chunk_id, skill_id, trigger, model)
            SELECT %s, %s, %s, %s
            WHERE (SELECT count(*) FROM app.assessment_generations
                   WHERE started_at >= date_trunc('day', now())) < %s
            RETURNING generation_id
            """,
            (chunk_id, chunk["skill_id"], trigger, self.model, self.daily_limit),
        ).fetchone()
        if row is None:
            log.info("Daily question generation limit (%s) reached", self.daily_limit)
            return 0
        failures: list[Exception] = []

        def call(prompt: str) -> str:
            try:
                return self._generate(prompt)
            except Exception as err:  # noqa: BLE001  recorded, then reported to draft_items as a failed reply
                failures.append(err)
                raise RuntimeError("model call failed") from err

        items = draft_items(chunk["skill_id"], chunk["skill_name"], [chunk], call,
                            generated_by=GENERATED_BY, status="provisional")
        items = keep_agreed(items, chunk["skill_name"], call)
        made = 0
        for item in items:
            made += c.execute(
                """
                INSERT INTO app.assessment_items (skill_id, chunk_id, level, stem, options, answer_index, quote,
                    source_title, source_heading, source_url, content_hash, status, generated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'provisional', %s)
                ON CONFLICT (skill_id, stem) DO NOTHING
                """,
                (item.skill_id, item.chunk_id, item.level, item.stem, Jsonb(item.options), item.answer_index,
                 item.quote, item.source_title, item.source_heading, item.source_url, item.content_hash,
                 item.generated_by),
            ).rowcount
        outcome = "created" if made else "failed" if failures else "empty"
        c.execute("UPDATE app.assessment_generations SET outcome = %s, items_created = %s, finished_at = now() "
                  "WHERE generation_id = %s", (outcome, made, row[0]))
        return made

    def _chunk(self, c: psycopg.Connection[Any], chunk_id: int, skill_id: int | None) -> dict[str, Any] | None:
        row = c.execute(
            """
            SELECT ch.content, s.source_url, COALESCE(NULLIF(ch.metadata->>'page_title', ''), s.title),
                   ch.metadata->'heading_path', sk.skill_id, sk.skill_name
            FROM knowledge.knowledge_chunks AS ch
            JOIN knowledge.knowledge_sources AS s USING (source_id)
            JOIN knowledge.knowledge_chunk_skills AS m USING (chunk_id)
            JOIN core.skills AS sk ON sk.skill_id = m.skill_id
            WHERE ch.chunk_id = %s AND s.is_active
            ORDER BY m.skill_id = %s DESC, m.skill_id
            LIMIT 1
            """,
            (chunk_id, skill_id),
        ).fetchone()
        if row is None:
            return None
        heading = row[3][-1] if isinstance(row[3], list) and row[3] else None
        return {"chunk_id": chunk_id, "content": row[0], "url": row[1], "title": row[2], "heading": heading,
                "skill_id": row[4], "skill_name": row[5]}

    def open_chunks(self, skill_id: int, limit: int) -> list[int]:
        """Chunks of a skill with no usable question and no recent run, longest first."""
        with self._connect() as c:
            rows = c.execute(
                """
                SELECT ch.chunk_id FROM knowledge.knowledge_chunk_skills AS m
                JOIN knowledge.knowledge_chunks AS ch USING (chunk_id)
                JOIN knowledge.knowledge_sources AS s USING (source_id)
                WHERE m.skill_id = %s AND s.is_active
                  AND NOT EXISTS (SELECT 1 FROM app.assessment_items AS i
                                  WHERE i.chunk_id = ch.chunk_id AND i.status = ANY(%s))
                  AND NOT EXISTS (SELECT 1 FROM app.assessment_generations AS g
                                  WHERE g.chunk_id = ch.chunk_id AND g.started_at > now() - interval '7 days')
                ORDER BY length(ch.content) DESC, ch.chunk_id
                LIMIT %s
                """,
                (skill_id, list(USABLE), limit),
            ).fetchall()
        return [r[0] for r in rows]


def build_generator(settings: CvSettings) -> QuestionGenerator | None:
    if settings.ASSESSMENT_AI_GENERATION != "gemini":
        return None
    key = (settings.GEMINI_API_KEY or "").strip()
    if not key:
        log.warning("ASSESSMENT_AI_GENERATION=gemini but GEMINI_API_KEY is empty; on-demand questions are off")
        return None
    generate, model = gemini_generate(key, settings.ASSESSMENT_GENERATION_TIMEOUT_S)
    return QuestionGenerator(settings, generate, model=model, daily_limit=settings.ASSESSMENT_DAILY_GENERATIONS,
                             timeout_s=settings.ASSESSMENT_GENERATION_TIMEOUT_S)
