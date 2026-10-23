"""Scoring rules for step checks and level checks. Pure functions; no database, no model calls.

Level check ("staircase-v2"): start at the level the self-check suggests, ask three questions at
that level, pass with two or more correct, then move up after a pass or down after a failure,
never testing a level twice. The result is the highest level passed, or no confirmed level when
all tested levels fail. Confidence is capped at medium. Step check: a study task
is verified when every question about it is answered correctly.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable, Sequence

LEVELS = ("beginner", "intermediate", "advanced")
SCORING_VERSION = "staircase-v2"
QUESTIONS_PER_LEVEL = 3
PASS_MARK = 2
MAX_QUESTIONS = QUESTIONS_PER_LEVEL * len(LEVELS)
STEP_QUESTIONS_PER_TASK = 2
STEP_MAX_QUESTIONS = 8
SELF_CHECK_ANSWERS = ("yes", "unsure", "no")


def self_check_level(answers: Iterable[tuple[str, str]]) -> int:
    """Index of the highest level whose statements were all answered "yes" (0 when none)."""
    by_level: dict[str, list[str]] = {}
    for level, answer in answers:
        by_level.setdefault(level, []).append(answer)
    best = 0
    for index, level in enumerate(LEVELS):
        given = by_level.get(level)
        if given and all(a == "yes" for a in given):
            best = index
    return best


def has_full_quiz(levels_available: dict[str, int]) -> bool:
    """A level check uses a quiz only when every level has enough approved questions."""
    return all(levels_available.get(level, 0) >= QUESTIONS_PER_LEVEL for level in LEVELS)


def advance(tested: dict[str, bool], level: int, correct: int) -> tuple[dict[str, bool], int | None]:
    """Record the batch at ``level`` and return the next level to test, or None to stop."""
    passed = correct >= PASS_MARK
    tested = {**tested, LEVELS[level]: passed}
    if passed and level + 1 < len(LEVELS) and LEVELS[level + 1] not in tested:
        return tested, level + 1
    if not passed and level > 0 and LEVELS[level - 1] not in tested:
        return tested, level - 1
    return tested, None


@dataclass(frozen=True)
class LevelOutcome:
    level: str | None
    confidence: str  # high | medium | low
    method: str  # quiz | self_check
    note: str


def level_outcome(tested: dict[str, bool], correct_by_level: dict[str, int], self_level: int,
                  *, quiz: bool) -> LevelOutcome:
    if not quiz:
        return LevelOutcome(LEVELS[self_level], "low", "self_check",
                            "Based on your self-check only. There are no reviewed questions for this skill yet.")
    passed = [level for level in LEVELS if tested.get(level) is True]
    if not passed:
        return LevelOutcome(None, "low", "quiz",
                            "Foundations not yet confirmed. Review the first steps of your roadmap and try again.")
    top = passed[-1]
    # Three questions per level do not establish high confidence in overall proficiency.
    confidence = "medium"
    return LevelOutcome(top, confidence, "quiz", "Short knowledge check; practical ability has not been assessed.")


def task_verdicts(answers: Iterable[tuple[str, bool]]) -> dict[str, bool]:
    """``(task_id, correct)`` pairs -> task verified only if all of its answers are correct."""
    verdict: dict[str, bool] = {}
    for task_id, correct in answers:
        verdict[task_id] = verdict.get(task_id, True) and correct
    return verdict


def pick_level_items(item_ids: Sequence[int], seen: set[int], rng: random.Random,
                     count: int = QUESTIONS_PER_LEVEL) -> list[int]:
    """Prefer questions the learner has not seen; fill with seen ones when the level runs short."""
    fresh = [i for i in item_ids if i not in seen]
    old = [i for i in item_ids if i in seen]
    rng.shuffle(fresh)
    rng.shuffle(old)
    return (fresh + old)[:count]


def pick_step_items(tasks: Sequence[tuple[str, Sequence[int]]], items_by_chunk: dict[int, Sequence[int]],
                    seen: set[int], rng: random.Random) -> list[tuple[str, int]]:
    """Up to two questions per study task (from the chunks it cites), at most eight in total.

    A question is used for one task only, in roadmap order, so two tasks citing the same chunk
    do not both claim it.
    """
    used: set[int] = set()
    picked: list[tuple[str, int]] = []
    for task_id, chunk_ids in tasks:
        pool = list(dict.fromkeys(i for c in chunk_ids for i in items_by_chunk.get(c, ()) if i not in used))
        for item_id in pick_level_items(pool, seen, rng, STEP_QUESTIONS_PER_TASK):
            used.add(item_id)
            picked.append((task_id, item_id))
    return picked[:STEP_MAX_QUESTIONS]
