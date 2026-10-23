"""Assessment core (ai/assessments): scoring, item checks, the seed bank, and the draft generator.

No database and no model calls; Gemini is replaced by a fake function.
"""

import json
import random
from pathlib import Path

import pytest

from ai.assessments.bank import Bank, BankItem, item_issues, normalize
from ai.assessments.scoring import (
    LEVELS, advance, has_full_quiz, level_outcome, pick_level_items, pick_step_items, self_check_level, task_verdicts,
)
from ai.assessments.generate import blind_check, draft_items, keep_agreed, write_prompt

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "ai/assessments/seed/demo_bank.json"
FIXTURE = ROOT / "ai/roadmap/fixtures/agent-context-demo-student.json"


def test_self_check_level_is_highest_level_answered_yes_throughout():
    assert self_check_level([("beginner", "yes"), ("beginner", "yes"), ("intermediate", "yes"),
                             ("intermediate", "unsure")]) == 0
    assert self_check_level([("beginner", "yes"), ("intermediate", "yes"), ("advanced", "no")]) == 1
    assert self_check_level([("beginner", "no"), ("advanced", "yes")]) == 2
    assert self_check_level([]) == 0


@pytest.mark.parametrize("start, batches, expected_levels, result", [
    (0, [3, 3, 2], ["beginner", "intermediate", "advanced"], "advanced"),  # climbs to the top
    (0, [3, 3, 1], ["beginner", "intermediate", "advanced"], "intermediate"),  # stops after failing advanced
    (1, [1, 3], ["intermediate", "beginner"], "beginner"),  # fails start level, passes the one below
    (2, [0, 0, 0], ["advanced", "intermediate", "beginner"], None),  # fails everything
    (1, [2, 3], ["intermediate", "advanced"], "advanced"),
])
def test_staircase_paths(start, batches, expected_levels, result):
    tested, level, visited = {}, start, []
    for correct in batches:
        visited.append(LEVELS[level])
        tested, level = advance(tested, level, correct)
        if level is None:
            break
    assert visited == expected_levels and level is None
    passed = [lvl for lvl in LEVELS if tested.get(lvl)]
    assert (passed[-1] if passed else None) == result


def test_confidence_rules():
    tested = {"beginner": True, "intermediate": True, "advanced": False}
    assert level_outcome(tested, {"intermediate": 3}, 1, quiz=True).confidence == "medium"
    assert level_outcome(tested, {"intermediate": 2}, 1, quiz=True).confidence == "medium"
    # Even a perfect top-level batch is at most medium confidence.
    top = {"beginner": True, "intermediate": True, "advanced": True}
    assert level_outcome(top, {"advanced": 3}, 0, quiz=True).confidence == "medium"
    none = level_outcome({"beginner": False}, {}, 0, quiz=True)
    assert (none.level, none.confidence, none.method) == (None, "low", "quiz")
    assert "Foundations not yet confirmed" in none.note
    self_only = level_outcome({}, {}, 2, quiz=False)
    assert (self_only.level, self_only.confidence, self_only.method) == ("advanced", "low", "self_check")


def test_task_verdicts_need_every_answer_right():
    assert task_verdicts([("a", True), ("b", True), ("b", False), ("c", True)]) == {"a": True, "b": False, "c": True}


def test_step_items_two_per_task_no_reuse_and_capped():
    rng = random.Random(1)
    by_chunk = {1: [10], 2: [20], 8: [80, 81, 82]}
    picks = pick_step_items([("t1", [1]), ("t2", [2]), ("t3", [8]), ("t4", [8])], by_chunk, set(), rng)
    assert [t for t, _ in picks].count("t3") == 2 and len({i for _, i in picks}) == len(picks)
    assert [i for t, i in picks if t == "t4"] == [next(i for i in (80, 81, 82) if ("t3", i) not in picks)]
    many = pick_step_items([(f"t{i}", [i]) for i in range(10)], {i: [i * 10, i * 10 + 1] for i in range(10)}, set(), rng)
    assert len(many) == 8


def test_unseen_questions_come_first():
    picked = pick_level_items([1, 2, 3, 4], {1, 2}, random.Random(0), 2)
    assert set(picked) == {3, 4}


def test_overlapping_chunks_do_not_repeat_a_question_within_a_task():
    picks = pick_step_items([("a", [1, 2])], {1: [10], 2: [10, 11]}, set(), random.Random(0))
    assert len(picks) == 2 and {item for _, item in picks} == {10, 11}


def test_full_quiz_needs_three_questions_at_every_level():
    assert has_full_quiz({"beginner": 4, "intermediate": 3, "advanced": 3})
    assert not has_full_quiz({"beginner": 3})


def test_seed_bank_is_valid_and_quotes_match_their_chunks():
    bank = Bank.model_validate_json(SEED.read_bytes())
    chunks = {e["chunk_id"]: e for e in json.loads(FIXTURE.read_text(encoding="utf-8"))["evidence_registry"]}
    for item in bank.items:
        assert item_issues(item, chunks[item.chunk_id]["content"]) == [], item.stem
        assert item.content_hash == chunks[item.chunk_id]["content_hash"]
    levels = {lvl: sum(i.skill_id == 103 and i.level == lvl for i in bank.items) for lvl in LEVELS}
    assert has_full_quiz(levels)  # Airflow supports a full level check
    assert not has_full_quiz({lvl: sum(i.skill_id == 87 and i.level == lvl for i in bank.items) for lvl in LEVELS})


def _item(**over):
    base = dict(skill_id=1, chunk_id=1, level="beginner", stem="What is a Dag in Airflow?",
                options=["A", "B", "C", "D"], answer_index=0, quote="a collection of tasks organized", source_title="T")
    return BankItem(**{**base, **over})


@pytest.mark.parametrize("change, message", [
    ({"options": ["A", "a", "C", "D"]}, "different"),
    ({"options": ["A", "B", "C", "All of the above"]}, "all/none"),
    ({"stem": "Explain what a Dag is in Airflow."}, "question mark"),
    ({"quote": "this sentence is not in the chunk at all"}, "exact passage"),
])
def test_item_checks(change, message):
    issues = item_issues(_item(**change), "At its core, a Dag is a collection of tasks organized in a way that...")
    assert any(message in i for i in issues), issues


def test_generator_drops_bad_questions_and_flags_disagreement():
    chunk = {"chunk_id": 2, "content": "At its core, a Dag is a collection of tasks organized in a way that reflects "
                                       "their relationships and dependencies.", "url": "https://x", "title": "Airflow 101",
             "heading": "What is a Dag?"}
    good = {"stem": "In Airflow, what is a Dag?", "options": ["Tasks with dependencies", "A log table", "A container",
                                                               "A user"], "answer_index": 0, "level": "beginner",
            "quote": "a Dag is a collection of tasks organized"}
    invented = {**good, "stem": "Who created Airflow?", "quote": "Airflow was created at Airbnb in 2014"}

    def fake(prompt: str) -> str:
        if prompt.startswith("You write"):
            return json.dumps({"items": [good, invented]})
        return json.dumps({"answer_index": 1})  # the blind answer disagrees

    items = draft_items(103, "Apache Airflow", [chunk], fake)
    assert [i.stem for i in items] == ["In Airflow, what is a Dag?"] and items[0].status == "draft"
    blind_check(items, "Apache Airflow", fake)
    assert items[0].flags == ["BLIND_ANSWER_DISAGREES"]
    assert normalize(items[0].quote) in normalize(chunk["content"])


def test_on_demand_drafts_are_provisional_and_strict():
    chunk = {"chunk_id": 2, "content": "At its core, a Dag is a collection of tasks organized in a way that reflects "
                                       "their relationships and dependencies.", "url": None, "title": "Airflow 101",
             "heading": None}
    base = {"options": ["Tasks with dependencies", "A log table", "A container", "A user"], "answer_index": 0,
            "level": "beginner", "quote": "a Dag is a collection of tasks organized"}
    agreed = {**base, "stem": "In Airflow, what is a Dag?"}
    disputed = {**base, "stem": "What does a Dag collect in Airflow?"}

    def fake(prompt: str) -> str:
        if prompt.startswith("You write"):
            return json.dumps({"items": [agreed, disputed]})
        return json.dumps({"answer_index": 0 if "what is a Dag" in prompt else 2})

    items = draft_items(103, "Apache Airflow", [chunk], fake, generated_by="gemini-on-demand", status="provisional")
    assert {i.status for i in items} == {"provisional"} and {i.generated_by for i in items} == {"gemini-on-demand"}
    assert [i.stem for i in keep_agreed(items, "Apache Airflow", fake)] == ["In Airflow, what is a Dag?"]


def test_write_prompt_level_hint():
    chunk = {"title": "T", "content": "C"}
    assert "Prefer the advanced level" in write_prompt("Airflow", chunk, "advanced")
    assert "Prefer the" not in write_prompt("Airflow", chunk)
