"""Assessments API with an in-memory repository: step checks, level checks, quick questions,
the overview page, ownership and the rule that answer keys stay hidden until a check ends."""

import copy
import random
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI

from ai.assessments.bank import Bank
from app.features.assessments.router import get_assessment_service, router
from app.features.assessments.service import AssessmentService

SEED = Path(__file__).resolve().parents[2] / "ai/assessments/seed/demo_bank.json"
PROFILE, SESSION, USER = "prf_a", "session-a", 5
SKILLS = {103: "Apache Airflow", 87: "RAG", 85: "Docker", 94: "Git"}


class _ItemsAccessor(dict):
    """Lets the fake expose item data and the repo.items(ids) call under one name."""

    def __call__(self, ids):
        return {i: copy.deepcopy(self[i]) for i in ids}


class FakeRepo:
    def __init__(self):
        bank = Bank.model_validate_json(SEED.read_bytes())
        self.items = _ItemsAccessor({n + 1: {**i.model_dump(), "item_id": n + 1} for n, i in enumerate(bank.items)})
        self.statements_data = [s.model_dump() for s in bank.statements]
        self.rows: dict[int, dict] = {}
        self.answers: dict[int, list] = {}
        self.profile: dict[int, dict] = {85: {"level": "unknown", "basis": "unknown"}}
        self.applied_steps = []

    def owner(self, profile_id, session_id):
        return USER if (profile_id, session_id) == (PROFILE, SESSION) else None

    def skill_name(self, skill_id):
        return SKILLS.get(skill_id)

    def statements(self, skill_id):
        specific = [s for s in self.statements_data if s["skill_id"] == skill_id]
        rows = specific or [s for s in self.statements_data if s["skill_id"] is None]
        return [{"id": n + 1, "level": s["level"], "position": s["position"],
                 "text": s["text"].replace("{skill}", SKILLS[skill_id])} for n, s in enumerate(rows)]

    def level_item_ids(self, skill_id):
        out = {}
        for i in self.items.values():
            if i["skill_id"] == skill_id and i["status"] == "approved":
                out.setdefault(i["level"], []).append(i["item_id"])
        return out

    def items_for_chunks(self, chunk_ids):
        out = {}
        for i in self.items.values():
            if i["chunk_id"] in chunk_ids:
                out.setdefault(i["chunk_id"], []).append(i["item_id"])
        return out

    def seen_items(self, user_id):
        return {a["item_id"] for rows in self.answers.values() for a in rows}

    def create(self, user_id, *, skill_id, kind, scoring_version, entry_point=None, roadmap_id=None, step_key=None,
               state=None, **fields):
        aid = len(self.rows) + 1
        now = datetime.now(timezone.utc)
        row = {"assessment_id": aid, "user_id": user_id, "skill_id": skill_id, "kind": kind, "status": "in_progress",
               "decision": "pending", "entry_point": entry_point, "roadmap_id": roadmap_id, "step_key": step_key,
               "method": None, "self_check_level": None, "result_level": None, "confidence": None,
               "scoring_version": scoring_version, "state": copy.deepcopy(state or {}), "summary": {},
               "started_at": now, "completed_at": None, "decided_at": None}
        for k, v in fields.items():
            row[k] = now if v == "now()" else v
        self.rows[aid] = row
        self.answers[aid] = []
        return aid

    def get(self, aid, user_id):
        row = self.rows.get(aid)
        if not row or row["user_id"] != user_id:
            return None
        return {**copy.deepcopy(row), "answers": copy.deepcopy(self.answers[aid]),
                "skill_name": SKILLS.get(row["skill_id"])}

    def update(self, aid, **fields):
        for k, v in fields.items():
            self.rows[aid][k] = datetime.now(timezone.utc) if v == "now()" else copy.deepcopy(v)

    def add_answers(self, aid, rows):
        for item_id, task_id, level, choice, correct in rows:
            self.answers[aid].append({"item_id": item_id, "task_id": task_id, "level": level, "choice": choice,
                                      "correct": correct})

    def decide(self, aid, user_id, decision, *, apply_level):
        self.rows[aid]["decision"] = decision
        self.rows[aid]["decided_at"] = datetime.now(timezone.utc)
        row = self.rows[aid]
        if apply_level and decision == "accepted":
            kept = [r for r in self.rows.values() if r["skill_id"] == row["skill_id"]
                    and r["decision"] == "accepted" and r["result_level"] is not None]
            if kept:
                best = max(kept, key=lambda r: (r["method"] == "quiz", r["decided_at"], r["assessment_id"]))
                self.profile[row["skill_id"]] = {"level": best["result_level"],
                                                "basis": "assessed" if best["method"] == "quiz" else "self_reported"}

    def roadmap_step(self, user_id, roadmap_id, step_key):
        return None

    def profile_level(self, user_id, skill_id):
        value = self.profile.get(skill_id)
        return {"skillId": skill_id, **value} if value else None

    def apply_step(self, *args):
        self.applied_steps.append(args)

    def level_targets(self, user_id):
        counts = {}
        for i in self.items.values():
            counts.setdefault(i["skill_id"], {}).setdefault(i["level"], 0)
            counts[i["skill_id"]][i["level"]] += 1
        out = [{"skill_id": s, "name": SKILLS[s], "level": p["level"], "basis": p["basis"], "in_profile": True,
                "level_counts": counts.get(s, {})} for s, p in self.profile.items()]
        out += [{"skill_id": s, "name": SKILLS[s], "level": None, "basis": None, "in_profile": False,
                 "level_counts": c} for s, c in counts.items() if s not in self.profile]
        return out

    def activity(self, user_id, limit=30):
        rows = [r for r in self.rows.values() if r["status"] == "completed"]
        return [{**r, "skill_name": SKILLS.get(r["skill_id"])} for r in reversed(rows)]

    def latest_step_checks(self, user_id):
        latest = {}
        for r in self.rows.values():
            if r["kind"] == "step_check" and r["status"] == "completed":
                latest[r["step_key"]] = r
        return list(latest.values())


class FakeGenerator:
    """Stands in for QuestionGenerator: writes one question for every requested chunk."""

    def __init__(self, repo):
        self.repo, self.calls, self.scheduled = repo, [], []

    async def fill(self, skill_id, chunk_ids, trigger="step_check"):
        self.calls.append((skill_id, list(chunk_ids)))
        for chunk_id in chunk_ids:
            item_id = max(self.repo.items) + 1
            self.repo.items[item_id] = {
                "item_id": item_id, "skill_id": skill_id, "chunk_id": chunk_id, "level": "beginner",
                "stem": f"What does chunk {chunk_id} say?", "options": ["A", "B", "C", "D"], "answer_index": 2,
                "quote": "a quote from the chunk", "source_title": "Docker docs", "source_heading": None,
                "source_url": None, "status": "provisional"}
        return len(chunk_ids)

    def schedule_skill(self, skill_id):
        self.scheduled.append(skill_id)


def make(generator=False):
    repo = FakeRepo()
    svc = AssessmentService(repo, rng=random.Random(7), generator=FakeGenerator(repo) if generator else None)
    repo.generator = svc.generator
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_assessment_service] = lambda: svc
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                               headers={"X-Session-Id": SESSION})
    return client, repo


BASE = f"/api/profiles/{PROFILE}/assessments"
AIRFLOW_TASKS = [{"taskId": "airflow-intro", "label": "Study: Build your first workflow", "chunkIds": [1]},
                 {"taskId": "airflow-dag", "label": "Study: What is a DAG?", "chunkIds": [2]},
                 {"taskId": "airflow-operators", "label": "Study: Understand operators", "chunkIds": [8]}]


async def test_failed_level_check_cannot_overwrite_profile():
    client, repo = make()
    before = copy.deepcopy(repo.profile)
    async with client:
        start = (await client.post(f"{BASE}/level-checks", json={"skillId": 103})).json()
        aid = start["assessmentId"]
        body = (await client.post(f"{BASE}/{aid}/self-check", json={
            "answers": {str(s["id"]): "yes" for s in start["statements"]}})).json()
        while "question" in body:
            item_id = body["question"]["itemId"]
            body = (await client.post(f"{BASE}/{aid}/answers", json={
                "itemId": item_id, "choice": (repo.items[item_id]["answer_index"] + 1) % 4})).json()
        assert body["result"]["level"] is None
        assert body["result"]["confidence"] == "low"
        assert (await client.post(f"{BASE}/{aid}/decision", json={"decision": "accepted"})).status_code == 409
        assert repo.profile == before
        assert (await client.post(f"{BASE}/{aid}/decision", json={"decision": "declined"})).status_code == 200


async def test_step_check_reports_tasks_without_questions():
    client, repo = make()
    omitted = {"taskId": "missing", "label": "Study: Missing source", "chunkIds": [999]}
    async with client:
        start = (await client.post(f"{BASE}/step-checks", json={
            "stepKey": "airflow", "skillId": 103, "tasks": [*AIRFLOW_TASKS, omitted]})).json()
        answers = [{"itemId": q["itemId"], "choice": repo.items[q["itemId"]]["answer_index"]}
                   for q in start["questions"]]
        result = (await client.post(f"{BASE}/{start['assessmentId']}/finish", json={"answers": answers})).json()
        assert result["unassessedTasks"] == [{"taskId": "missing", "label": omitted["label"]}]
        applied = (await client.post(f"{BASE}/{start['assessmentId']}/apply", json={"apply": True})).json()
        assert "missing" not in applied["verifiedTaskIds"] + applied["reviewTaskIds"]


async def test_step_check_hides_key_then_verifies_tasks():
    client, repo = make()
    async with client:
        r = await client.post(f"{BASE}/step-checks", json={"stepKey": "airflow", "skillId": 103,
                                                             "tasks": AIRFLOW_TASKS, "entryPoint": "roadmap"})
        assert r.status_code == 201, r.text
        started = r.json()
        assert started["taskCount"] == 3 and len(started["questions"]) == 4
        assert all("answerIndex" not in q and "quote" not in q for q in started["questions"])
        # right on everything except one operators question
        wrong = next(q["itemId"] for q in started["questions"] if q["taskId"] == "airflow-operators")
        answers = [{"itemId": q["itemId"], "choice": (repo.items[q["itemId"]]["answer_index"] + (q["itemId"] == wrong)) % 4}
                   for q in started["questions"]]
        r = await client.post(f"{BASE}/{started['assessmentId']}/finish", json={"answers": answers})
        result = r.json()
        assert result["verifiedCount"] == 2 and result["taskCount"] == 3
        operators = next(t for t in result["tasks"] if t["taskId"] == "airflow-operators")
        assert operators["verified"] is False and operators["questions"][0]["quote"]
        assert (await client.post(f"{BASE}/{started['assessmentId']}/finish", json={"answers": answers})).status_code == 409

        r = await client.post(f"{BASE}/{started['assessmentId']}/apply", json={"apply": True})
        assert r.json()["verifiedTaskIds"] == ["airflow-intro", "airflow-dag"]
        assert repo.applied_steps == []  # a mock roadmap step is ticked by the client, not the server

        page = (await client.get(BASE)).json()
        assert page["stats"]["verifiedTasks"] == 2
        assert page["stepChecks"][0]["reviewTaskIds"] == ["airflow-operators"]
        assert page["activity"][0]["text"] == "2 of 3 study tasks verified"


async def test_step_check_without_reviewed_questions():
    client, _ = make()
    async with client:
        r = await client.post(f"{BASE}/step-checks", json={"stepKey": "docker", "tasks": [
            {"taskId": "docker-platform", "label": "Study: Containers", "chunkIds": [999]}]})
        assert r.status_code == 409 and r.json()["error"]["code"] == "NO_CHECK_QUESTIONS"


async def test_level_check_adapts_and_keeps_result():
    client, repo = make()
    async with client:
        r = await client.post(f"{BASE}/level-checks", json={"skillId": 103})
        start = r.json()
        assert start["hasQuiz"] and len(start["statements"]) == 6
        answers = {str(s["id"]): ("yes" if s["level"] != "advanced" else "no") for s in start["statements"]}
        r = await client.post(f"{BASE}/{start['assessmentId']}/self-check", json={"answers": answers})
        question = r.json()["question"]
        assert "answerIndex" not in question and question["number"] == 1
        # answering a different item than the current one is refused
        other = next(i for i in repo.items if i != question["itemId"])
        bad = await client.post(f"{BASE}/{start['assessmentId']}/answers", json={"itemId": other, "choice": 0})
        assert bad.status_code == 409
        result = None
        for _ in range(12):
            item = repo.items[question["itemId"]]
            choice = item["answer_index"] if item["level"] != "advanced" else (item["answer_index"] + 1) % 4
            body = (await client.post(f"{BASE}/{start['assessmentId']}/answers",
                                      json={"itemId": question["itemId"], "choice": choice})).json()
            if "result" in body:
                result = body["result"]
                break
            question = body["question"]
        assert result["level"] == "intermediate" and result["confidence"] == "medium" and result["method"] == "quiz"
        assert [s["status"] for s in result["ladder"]] == ["not_tested", "passed", "not_passed"]
        assert result["review"] and all("quote" in r for r in result["review"])

        r = await client.post(f"{BASE}/{start['assessmentId']}/decision", json={"decision": "accepted"})
        assert r.json()["profileLevel"] == {"skillId": 103, "level": "intermediate", "basis": "assessed"}
        page = (await client.get(BASE)).json()
        airflow = next(x for x in page["levelChecks"] if x["skillId"] == 103)
        assert airflow["level"] == "intermediate" and airflow["reason"] == "Level checked by quiz"
        rating = await client.post(f"{BASE}/quick", json={
            "skillId": 103, "level": "beginner", "answer": "Just starting"})
        assert rating.json()["profileLevel"] == {"skillId": 103, "level": "intermediate", "basis": "assessed"}
        again = await client.post(f"{BASE}/{start['assessmentId']}/decision", json={"decision": "declined"})
        assert again.status_code == 409


async def test_self_check_only_skill_and_quick_question():
    client, repo = make()
    async with client:
        start = (await client.post(f"{BASE}/level-checks", json={"skillId": 87})).json()
        assert start["hasQuiz"] is False  # RAG has beginner questions only
        answers = {str(s["id"]): "yes" for s in start["statements"]}
        result = (await client.post(f"{BASE}/{start['assessmentId']}/self-check", json={"answers": answers})).json()["result"]
        assert (result["level"], result["confidence"], result["method"]) == ("advanced", "low", "self_check")

        r = await client.post(f"{BASE}/quick", json={"skillId": 85, "level": "beginner", "answer": "I can run containers",
                                                      "entryPoint": "roadmap", "stepKey": "docker"})
        assert r.status_code == 201 and repo.profile[85] == {"level": "beginner", "basis": "self_reported"}
        page = (await client.get(BASE)).json()
        assert page["activity"][0]["text"] == "Quick question: I can run containers → beginner"
        assert (await client.post(f"{BASE}/quick", json={"skillId": 85, "level": "expert", "answer": "x"})).status_code == 400


async def test_other_sessions_and_incomplete_answers_are_refused():
    client, _ = make()
    async with client:
        r = await client.get(BASE, headers={"X-Session-Id": "intruder"})
        assert r.status_code == 404 and r.json()["error"]["code"] == "PROFILE_NOT_FOUND"
        start = (await client.post(f"{BASE}/step-checks", json={"stepKey": "airflow", "tasks": AIRFLOW_TASKS})).json()
        some = [{"itemId": start["questions"][0]["itemId"], "choice": 0}]
        r = await client.post(f"{BASE}/{start['assessmentId']}/finish", json={"answers": some})
        assert r.status_code == 400
        r = await client.get(f"{BASE}/{start['assessmentId']}", headers={"X-Session-Id": "intruder"})
        assert r.status_code == 404


async def test_step_check_writes_questions_for_tasks_without_any():
    client, repo = make(generator=True)
    tasks = [{"taskId": "airflow-dag", "label": "Study: What is a DAG?", "chunkIds": [2]},
             {"taskId": "docker-platform", "label": "Study: Containers", "chunkIds": [900, 901]}]
    async with client:
        r = await client.post(f"{BASE}/step-checks", json={"stepKey": "docker", "skillId": 85, "tasks": tasks})
        assert r.status_code == 201, r.text
        started = r.json()
        assert repo.generator.calls == [(85, [900])]  # only the task with no question, its first chunk
        assert {q["taskId"] for q in started["questions"]} == {"airflow-dag", "docker-platform"}
        assert all("answerIndex" not in q for q in started["questions"])
        answers = [{"itemId": q["itemId"], "choice": repo.items[q["itemId"]]["answer_index"]} for q in started["questions"]]
        result = (await client.post(f"{BASE}/{started['assessmentId']}/finish", json={"answers": answers})).json()
        assert result["verifiedCount"] == 2

        await client.post(f"{BASE}/step-checks", json={"stepKey": "airflow", "skillId": 103, "tasks": AIRFLOW_TASKS})
        assert len(repo.generator.calls) == 1  # every Airflow task already has reviewed questions


async def test_level_check_without_quiz_asks_for_background_drafts():
    client, repo = make(generator=True)
    async with client:
        start = (await client.post(f"{BASE}/level-checks", json={"skillId": 85})).json()
        assert start["hasQuiz"] is False and repo.generator.scheduled == [85]
        await client.post(f"{BASE}/level-checks", json={"skillId": 103})
        assert repo.generator.scheduled == [85]  # Airflow has a full quiz


async def test_missing_self_check_statements_do_not_create_an_empty_assessment():
    client, repo = make(generator=True)
    repo.statements_data = []
    async with client:
        response = await client.post(f"{BASE}/level-checks", json={"skillId": 85})
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "SELF_CHECK_NOT_READY"
        assert repo.rows == {}
        assert repo.generator.scheduled == []


async def test_legacy_empty_self_check_requires_restarting_after_setup():
    client, repo = make()
    async with client:
        start = (await client.post(f"{BASE}/level-checks", json={"skillId": 85})).json()
        aid = start["assessmentId"]
        repo.rows[aid]["state"]["statements"] = {}
        response = await client.post(f"{BASE}/{aid}/self-check", json={"answers": {"1": "yes"}})
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "SELF_CHECK_NOT_READY"
        assert repo.rows[aid]["status"] == "in_progress"
