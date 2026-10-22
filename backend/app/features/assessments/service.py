"""Skill assessment flows. See docs/assessments/assessment-plan.md (design v3).

- Step check: questions tied to the study tasks of one roadmap step, answered in one go. Each
  task is verified when all of its questions are right. Applying ticks the verified tasks.
- Level check: self-check, then an adaptive quiz (one question at a time, held server side).
  Keeping the result writes the level into the profile.
- Quick question: a one-tap self rating that is kept immediately.

Models are called only through the optional QuestionGenerator (generator.py): a step check whose
study tasks have no question waits for on-demand drafts, and a level check without a full quiz
asks for background drafts. Answer keys never leave the server before a check is finished.
"""

from __future__ import annotations

import asyncio
import random
from typing import Any

from ai.assessments.scoring import (
    LEVELS, MAX_QUESTIONS, SCORING_VERSION, SELF_CHECK_ANSWERS, advance, has_full_quiz, level_outcome,
    pick_level_items, pick_step_items, self_check_level, task_verdicts,
)
from app.features.resume.errors import AppError

ENTRY_POINTS = {"roadmap", "assessments", "skill_profile"}


class AssessmentService:
    def __init__(self, repo: Any, rng: random.Random | None = None, generator: Any = None):
        self.repo = repo
        self.rng = rng or random.Random()
        self.generator = generator

    async def _run(self, fn, *args, **kwargs):
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def owner(self, profile_id: str, session_id: str) -> int:
        user_id = await self._run(self.repo.owner, profile_id, session_id)
        if user_id is None:
            raise AppError("PROFILE_NOT_FOUND")
        return user_id

    async def _load(self, user_id: int, assessment_id: int, kind: str | None = None) -> dict[str, Any]:
        record = await self._run(self.repo.get, assessment_id, user_id)
        if record is None or (kind and record["kind"] != kind):
            raise AppError("ASSESSMENT_NOT_FOUND")
        return record

    # ------------------------------------------------------------------ step check

    async def start_step_check(self, profile_id: str, session_id: str, *, step_key: str, skill_id: int | None,
                               roadmap_id: int | None, tasks: list[dict[str, Any]] | None,
                               entry_point: str | None) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        if roadmap_id is not None:
            step = await self._run(self.repo.roadmap_step, user_id, roadmap_id, step_key)
            if step is None:
                raise AppError("ROADMAP_NOT_FOUND", "The roadmap step was not found.")
            skill_id, tasks = step["skill_id"] or skill_id, step["tasks"]
        if not tasks:
            raise AppError("NO_CHECK_QUESTIONS")
        chunk_ids = sorted({c for t in tasks for c in t["chunk_ids"]})
        by_chunk = await self._run(self.repo.items_for_chunks, chunk_ids) if chunk_ids else {}
        missing = [t["chunk_ids"][0] for t in tasks
                   if t["chunk_ids"] and not any(by_chunk.get(c) for c in t["chunk_ids"])]
        if missing and self.generator is not None:
            # Read again even when this call wrote nothing: a parallel request may have written them.
            await self.generator.fill(skill_id, missing)
            by_chunk = await self._run(self.repo.items_for_chunks, chunk_ids)
        seen = await self._run(self.repo.seen_items, user_id)
        picks = pick_step_items([(t["task_id"], t["chunk_ids"]) for t in tasks], by_chunk, seen, self.rng)
        if not picks:
            raise AppError("NO_CHECK_QUESTIONS")
        items = await self._run(self.repo.items, [i for _, i in picks])
        labels = {t["task_id"]: t["label"] for t in tasks}
        checked_tasks = list(dict.fromkeys(task_id for task_id, _ in picks))
        state = {"tasks": [{"taskId": t, "label": labels[t]} for t in checked_tasks],
                 "questions": [[task_id, item_id] for task_id, item_id in picks]}
        assessment_id = await self._run(
            self.repo.create, user_id, skill_id=skill_id, kind="step_check", scoring_version=SCORING_VERSION,
            entry_point=_entry(entry_point), roadmap_id=roadmap_id, step_key=step_key, state=state, method="quiz")
        return {
            "assessmentId": assessment_id, "kind": "step_check", "stepKey": step_key, "taskCount": len(checked_tasks),
            "questions": [{"itemId": item_id, "taskId": task_id, "taskLabel": labels[task_id],
                           "stem": items[item_id]["stem"], "options": items[item_id]["options"]}
                          for task_id, item_id in picks],
        }

    async def finish_step_check(self, profile_id: str, session_id: str, assessment_id: int,
                                answers: dict[int, int]) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id, "step_check")
        if record["status"] != "in_progress":
            raise AppError("ASSESSMENT_STATE_INVALID", "This check is already finished.")
        questions = [(task_id, item_id) for task_id, item_id in record["state"]["questions"]]
        if set(answers) != {item_id for _, item_id in questions}:
            raise AppError("INVALID_REQUEST", "Answer every question of the check exactly once.")
        items = await self._run(self.repo.items, [i for _, i in questions])
        rows = [(item_id, task_id, None, answers[item_id], answers[item_id] == items[item_id]["answer_index"])
                for task_id, item_id in questions]
        await self._run(self.repo.add_answers, assessment_id, rows)
        verdict = task_verdicts((task_id, correct) for _, task_id, _, _, correct in rows)
        tasks = record["state"]["tasks"]
        summary = {"tasks": [{"taskId": t["taskId"], "label": t["label"], "verified": verdict.get(t["taskId"], False)}
                             for t in tasks],
                   "asked": len(rows), "correct": sum(r[4] for r in rows)}
        summary["verified"] = sum(t["verified"] for t in summary["tasks"])
        await self._run(self.repo.update, assessment_id, status="completed", completed_at="now()", summary=summary)
        record = await self._load(user_id, assessment_id)
        return await self._step_result(record)

    async def apply_step_check(self, profile_id: str, session_id: str, assessment_id: int, apply: bool) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id, "step_check")
        if record["status"] != "completed" or record["decision"] != "pending":
            raise AppError("ASSESSMENT_STATE_INVALID", "This check cannot be applied now.")
        tasks = record["summary"]["tasks"]
        verified = [t["taskId"] for t in tasks if t["verified"]]
        review = [t["taskId"] for t in tasks if not t["verified"]]
        if apply and record["roadmap_id"] is not None:
            await self._run(self.repo.apply_step, user_id, record["roadmap_id"], record["step_key"], assessment_id,
                            verified, review)
        await self._run(self.repo.decide, assessment_id, user_id, "accepted" if apply else "declined",
                        apply_level=False)
        return {"assessmentId": assessment_id, "decision": "accepted" if apply else "declined",
                "verifiedTaskIds": verified, "reviewTaskIds": review}

    async def _step_result(self, record: dict[str, Any]) -> dict[str, Any]:
        answers = {a["item_id"]: a for a in record["answers"]}
        items = await self._run(self.repo.items, list(answers))
        by_task: dict[str, list[dict[str, Any]]] = {}
        for task_id, item_id in record["state"]["questions"]:
            by_task.setdefault(task_id, []).append(_review(items[item_id], answers.get(item_id)))
        summary = record["summary"]
        return {
            "assessmentId": record["assessment_id"], "kind": "step_check", "stepKey": record["step_key"],
            "decision": record["decision"], "verifiedCount": summary.get("verified", 0),
            "taskCount": len(summary.get("tasks", [])),
            "tasks": [{"taskId": t["taskId"], "label": t["label"], "verified": t["verified"],
                       "questions": by_task.get(t["taskId"], [])} for t in summary.get("tasks", [])],
        }

    # ------------------------------------------------------------------ level check

    async def start_level_check(self, profile_id: str, session_id: str, skill_id: int,
                                entry_point: str | None) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        name = await self._run(self.repo.skill_name, skill_id)
        if name is None:
            raise AppError("SKILL_NOT_FOUND")
        statements = await self._run(self.repo.statements, skill_id)
        levels = await self._run(self.repo.level_item_ids, skill_id)
        quiz = has_full_quiz({level: len(ids) for level, ids in levels.items()})
        if not quiz and self.generator is not None:
            self.generator.schedule_skill(skill_id)  # drafts for review; this check uses the self-check
        assessment_id = await self._run(
            self.repo.create, user_id, skill_id=skill_id, kind="level_check", scoring_version=SCORING_VERSION,
            entry_point=_entry(entry_point), state={"stage": "self_check", "quiz": quiz,
                                                    "statements": {str(s["id"]): s["level"] for s in statements}},
            method="quiz" if quiz else "self_check")
        return {"assessmentId": assessment_id, "kind": "level_check", "skill": {"skillId": skill_id, "name": name},
                "hasQuiz": quiz, "maxQuestions": MAX_QUESTIONS if quiz else 0,
                "statements": [{"id": s["id"], "level": s["level"], "text": s["text"]} for s in statements]}

    async def submit_self_check(self, profile_id: str, session_id: str, assessment_id: int,
                                answers: dict[str, str]) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id, "level_check")
        state = record["state"]
        if record["status"] != "in_progress" or state.get("stage") != "self_check":
            raise AppError("ASSESSMENT_STATE_INVALID", "The self-check was already answered.")
        expected = state["statements"]
        if set(answers) != set(expected) or any(a not in SELF_CHECK_ANSWERS for a in answers.values()):
            raise AppError("INVALID_REQUEST", "Answer every statement with yes, unsure or no.")
        self_level = self_check_level((expected[k], v) for k, v in answers.items())
        if not state["quiz"]:
            return await self._finish_level(record, {**state, "stage": "done", "selfLevel": self_level,
                                                     "selfAnswers": answers, "tested": {}, "correct": {}})
        levels = await self._run(self.repo.level_item_ids, record["skill_id"])
        seen = await self._run(self.repo.seen_items, user_id)
        queue = pick_level_items(levels.get(LEVELS[self_level], []), seen, self.rng)
        state = {**state, "stage": "quiz", "selfLevel": self_level, "selfAnswers": answers, "current": self_level,
                 "queue": queue, "tested": {}, "correct": {}, "asked": 0}
        await self._run(self.repo.update, assessment_id, state=state, self_check_level=LEVELS[self_level])
        return {"assessmentId": assessment_id, "question": await self._question(state)}

    async def answer_level_question(self, profile_id: str, session_id: str, assessment_id: int, item_id: int,
                                    choice: int) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id, "level_check")
        state = record["state"]
        if record["status"] != "in_progress" or state.get("stage") != "quiz":
            raise AppError("ASSESSMENT_STATE_INVALID", "This check is not waiting for an answer.")
        if not state["queue"] or state["queue"][0] != item_id:
            raise AppError("ASSESSMENT_STATE_INVALID", "Answer the current question.")
        item = (await self._run(self.repo.items, [item_id]))[item_id]
        level = LEVELS[state["current"]]
        correct = choice == item["answer_index"]
        await self._run(self.repo.add_answers, assessment_id, [(item_id, None, level, choice, correct)])
        state = {**state, "queue": state["queue"][1:], "asked": state["asked"] + 1,
                 "correct": {**state["correct"], level: state["correct"].get(level, 0) + int(correct)}}
        if not state["queue"]:
            tested, nxt = advance(state["tested"], state["current"], state["correct"].get(level, 0))
            state["tested"] = tested
            if nxt is None:
                return await self._finish_level(record, {**state, "stage": "done"})
            levels = await self._run(self.repo.level_item_ids, record["skill_id"])
            seen = await self._run(self.repo.seen_items, user_id)
            state = {**state, "current": nxt, "queue": pick_level_items(levels.get(LEVELS[nxt], []), seen, self.rng)}
        await self._run(self.repo.update, assessment_id, state=state)
        return {"assessmentId": assessment_id, "question": await self._question(state)}

    async def _question(self, state: dict[str, Any]) -> dict[str, Any]:
        item_id = state["queue"][0]
        item = (await self._run(self.repo.items, [item_id]))[item_id]
        return {"itemId": item_id, "stem": item["stem"], "options": item["options"],
                "number": state["asked"] + 1, "maxQuestions": MAX_QUESTIONS}

    async def _finish_level(self, record: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
        outcome = level_outcome(state.get("tested", {}), state.get("correct", {}), state["selfLevel"],
                                quiz=state["quiz"])
        summary = {"asked": state.get("asked", 0), "correct": sum(state.get("correct", {}).values()),
                   "note": outcome.note, "selfCheckLevel": LEVELS[state["selfLevel"]]}
        await self._run(self.repo.update, record["assessment_id"], state=state, status="completed",
                        completed_at="now()", method=outcome.method, result_level=outcome.level,
                        confidence=outcome.confidence, self_check_level=LEVELS[state["selfLevel"]], summary=summary)
        record = await self._load(record["user_id"], record["assessment_id"])
        return {"assessmentId": record["assessment_id"], "result": await self._level_result(record)}

    async def _level_result(self, record: dict[str, Any]) -> dict[str, Any]:
        state, summary = record["state"], record["summary"]
        answers = record["answers"]
        items = await self._run(self.repo.items, [a["item_id"] for a in answers]) if answers else {}
        ladder = []
        for level in LEVELS:
            given = [a for a in answers if a["level"] == level]
            tested = state.get("tested", {}).get(level)
            ladder.append({"level": level, "asked": len(given), "correct": sum(a["correct"] for a in given),
                           "answers": [a["correct"] for a in given],
                           "status": "passed" if tested is True else "not_passed" if tested is False else "not_tested"})
        return {
            "assessmentId": record["assessment_id"], "kind": "level_check",
            "skill": {"skillId": record["skill_id"], "name": record["skill_name"]},
            "level": record["result_level"], "confidence": record["confidence"], "method": record["method"],
            "note": summary.get("note", ""), "selfCheckLevel": record["self_check_level"],
            "asked": summary.get("asked", 0), "correct": summary.get("correct", 0),
            "ladder": ladder if record["method"] == "quiz" else [],
            "review": [_review(items[a["item_id"]], a) for a in answers],
            "decision": record["decision"],
        }

    async def decide_level_check(self, profile_id: str, session_id: str, assessment_id: int,
                                 decision: str) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id, "level_check")
        if record["status"] != "completed" or record["decision"] != "pending":
            raise AppError("ASSESSMENT_STATE_INVALID", "This result cannot be changed now.")
        await self._run(self.repo.decide, assessment_id, user_id, decision, apply_level=True)
        return {"assessmentId": assessment_id, "decision": decision,
                "profileLevel": {"skillId": record["skill_id"], "level": record["result_level"],
                                 "basis": "assessed" if record["method"] == "quiz" else "self_reported"}
                if decision == "accepted" else None}

    # ------------------------------------------------------------------ quick question

    async def quick_question(self, profile_id: str, session_id: str, *, skill_id: int, level: str, answer: str,
                             entry_point: str | None, step_key: str | None) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        if await self._run(self.repo.skill_name, skill_id) is None:
            raise AppError("SKILL_NOT_FOUND")
        assessment_id = await self._run(
            self.repo.create, user_id, skill_id=skill_id, kind="quick_question", scoring_version=SCORING_VERSION,
            entry_point=_entry(entry_point), step_key=step_key, status="completed", method="self_check",
            result_level=level, confidence="low", summary={"answer": answer}, completed_at="now()")
        await self._run(self.repo.decide, assessment_id, user_id, "accepted", apply_level=True)
        return {"assessmentId": assessment_id, "decision": "accepted",
                "profileLevel": {"skillId": skill_id, "level": level, "basis": "self_reported"}}

    # ------------------------------------------------------------------ read

    async def get(self, profile_id: str, session_id: str, assessment_id: int) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        record = await self._load(user_id, assessment_id)
        if record["kind"] == "step_check" and record["status"] == "completed":
            return await self._step_result(record)
        if record["kind"] == "level_check" and record["status"] == "completed":
            return await self._level_result(record)
        return {"assessmentId": assessment_id, "kind": record["kind"], "status": record["status"]}

    async def overview(self, profile_id: str, session_id: str) -> dict[str, Any]:
        user_id = await self.owner(profile_id, session_id)
        targets = await self._run(self.repo.level_targets, user_id)
        activity = await self._run(self.repo.activity, user_id)
        steps = await self._run(self.repo.latest_step_checks, user_id)
        level_checks = []
        for t in targets:
            quiz = has_full_quiz(t["level_counts"])
            level_checks.append({"skillId": t["skill_id"], "name": t["name"], "inProfile": t["in_profile"],
                                 "level": None if t["level"] in (None, "unknown") else t["level"],
                                 "basis": t["basis"], "hasQuiz": quiz, "reason": _reason(t)})
        level_checks.sort(key=lambda x: (x["level"] is not None, not x["hasQuiz"], x["name"].lower()))
        known = [x for x in level_checks if x["inProfile"] and x["level"]]
        verified_tasks = sum(s["summary"].get("verified", 0) for s in steps if s["decision"] == "accepted")
        return {
            "stats": {"verifiedTasks": verified_tasks, "skillsWithLevel": len(known),
                      "profileSkills": sum(x["inProfile"] for x in level_checks)},
            "levelChecks": level_checks,
            "stepChecks": [{"stepKey": s["step_key"], "roadmapId": s["roadmap_id"], "assessmentId": s["assessment_id"],
                            "verified": s["summary"].get("verified", 0), "taskCount": len(s["summary"].get("tasks", [])),
                            "decision": s["decision"], "completedAt": _iso(s["completed_at"]),
                            "verifiedTaskIds": [t["taskId"] for t in s["summary"].get("tasks", []) if t["verified"]],
                            "reviewTaskIds": [t["taskId"] for t in s["summary"].get("tasks", []) if not t["verified"]]}
                           for s in steps],
            "activity": [_activity(a) for a in activity],
        }


def _entry(entry_point: str | None) -> str | None:
    return entry_point if entry_point in ENTRY_POINTS else None


def _review(item: dict[str, Any], answer: dict[str, Any] | None) -> dict[str, Any]:
    return {"itemId": item["item_id"], "stem": item["stem"], "options": item["options"],
            "choice": answer["choice"] if answer else None, "correct": bool(answer and answer["correct"]),
            "answerIndex": item["answer_index"], "quote": item["quote"],
            "source": {"title": item["source_title"], "heading": item["source_heading"], "url": item["source_url"]}}


BASIS_REASON = {"explicit": "Level from your CV", "inferred": "Level estimated from your CV",
                "self_reported": "Level you reported", "assessed": "Level checked by quiz"}


def _reason(target: dict[str, Any]) -> str:
    if not target["in_profile"]:
        return "Not in your profile yet"
    if target["level"] in (None, "unknown"):
        return "Level not assessed"
    return BASIS_REASON.get(target["basis"], "Level from your profile")


def _activity(a: dict[str, Any]) -> dict[str, Any]:
    summary = a["summary"] or {}
    if a["kind"] == "step_check":
        text = f"{summary.get('verified', 0)} of {len(summary.get('tasks', []))} study tasks verified"
    elif a["kind"] == "quick_question":
        text = f"Quick question: {summary.get('answer', '')} → {a['result_level']}"
    else:
        text = f"{(a['result_level'] or '').capitalize()} · {a['confidence']} confidence" + (
            " · self-check only" if a["method"] == "self_check" else "")
    return {"assessmentId": a["assessment_id"], "kind": a["kind"], "skillId": a["skill_id"],
            "skillName": a.get("skill_name"), "stepKey": a["step_key"], "text": text, "decision": a["decision"],
            "at": _iso(a["decided_at"] or a["completed_at"] or a["started_at"])}


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None
