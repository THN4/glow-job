"""Roadmap API flow with an in-memory repository and the free mock model.

goal -> start job -> poll -> current roadmap -> task progress, plus ownership,
reuse of identical inputs, and the paid-provider spend guards.
"""

import asyncio
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

from ai.roadmap.contracts import RoadmapView
from ai.roadmap.providers import MockRoadmapModel
from ai.roadmap.view import apply_progress
from app.features.roadmap.config import RoadmapSettings
from app.features.roadmap.router import get_roadmap_service, router
from app.features.roadmap.service import RoadmapService
from rag.context.agent_models import AgentContext

FIXTURE = Path(__file__).resolve().parents[2] / "ai/roadmap/fixtures/agent-context-demo-student.json"
PROFILE, SESSION, USER = "prf_test", "session-1", 7
GOAL_BODY = {"careerProfileId": 1, "readinessTimeframe": "three_months", "weeklyAvailability": "hours_2_to_5",
             "preferredLearningStyle": "hands_on_projects", "additionalContext": "Internship prep"}


class FakeRepo:
    def __init__(self):
        self.goal = None
        self.roadmaps: dict[int, dict] = {}
        self.runs: list[dict] = []
        self.month_cost = 0.0
        self.contexts_built = 0

    def owner(self, profile_id, session_id):
        return USER if (profile_id, session_id) == (PROFILE, SESSION) else None

    def get_goal(self, user_id):
        return self.goal

    def put_goal(self, user_id, goal):
        self.goal = {"goalId": 2, "careerId": 1, "careerProfileId": goal["career_profile_id"],
                     "targetRoleTitle": goal["target_role_title"] or "Data Engineer",
                     "readinessTimeframe": goal["readiness_timeframe"], "targetDate": None,
                     "weeklyAvailability": goal["weekly_availability"], "availableHoursPerWeek": None,
                     "preferredLearningStyle": goal["preferred_learning_style"],
                     "additionalContext": goal["additional_context"], "updatedAt": "2026-10-19T00:00:00+00:00"}
        return self.goal

    def build_context(self, profile_id, career_profile_id, knowledge_file, date_basis):
        self.contexts_built += 1
        return AgentContext.model_validate_json(FIXTURE.read_bytes())

    def reusable_roadmap(self, user_id, goal_id, input_sha256):
        return next((rid for rid, r in self.roadmaps.items()
                     if r["status"] == "active" and r["sha"] == input_sha256), None)

    def usage(self, user_id):
        today = len(self.runs)
        return {"user_today": today, "all_today": today, "month_cost_usd": self.month_cost}

    def start_run(self, user_id, provider, model_id):
        self.runs.append({"provider": provider, "status": "running"})
        return len(self.runs)

    def finish_run(self, ai_run_id, **kwargs):
        self.runs[ai_run_id - 1].update(kwargs)

    def save(self, user_id, goal, context, result, ai_run_id, reason):
        for r in self.roadmaps.values():
            r["status"] = "replaced"
        roadmap_id = len(self.roadmaps) + 1
        self.roadmaps[roadmap_id] = {"view": result.view, "sha": result.input_sha256, "status": "active",
                                     "done": set(), "version": roadmap_id, "started": set(), "skipped": set()}
        return roadmap_id

    def current(self, user_id):
        rid = next((rid for rid, r in self.roadmaps.items() if r["status"] == "active"), None)
        if rid is None:
            return None
        r = self.roadmaps[rid]
        view = RoadmapView.model_validate(r["view"].model_dump(by_alias=True))
        view = view.model_copy(update={"roadmap_id": rid, "version": r["version"], "status": "active"})
        return apply_progress(view, completed_tasks=r["done"], skipped_steps=r["skipped"],
                              started_steps=r["started"], today=date(2026, 10, 19))

    def set_task(self, user_id, roadmap_id, item_id, completed):
        r = self.roadmaps.get(roadmap_id)
        if r is None or not any(i.id == item_id for n in r["view"].nodes for i in n.checklist):
            return False
        (r["done"].add if completed else r["done"].discard)(item_id)
        return True

    def set_step(self, user_id, roadmap_id, step_key, status):
        r = self.roadmaps.get(roadmap_id)
        node = next((n for n in r["view"].nodes if n.key == step_key and n.kind != "goal"), None) if r else None
        if node is None:
            return False
        ids = {i.id for i in node.checklist}
        if status == "completed":
            r["done"] |= ids
        elif status == "not_started":
            r["done"] -= ids
        for marks in (r["started"], r["skipped"]):
            marks.discard(step_key)
        if status == "in_progress":
            r["started"].add(step_key)
        elif status == "skipped":
            r["skipped"].add(step_key)
        return True


class PaidMock(MockRoadmapModel):
    """The free mock, labelled as a paid provider so the spend guards apply."""

    provider = "anthropic"

    def generate(self, compact):
        turn = super().generate(compact)
        turn.usage.add(SimpleNamespace(input_tokens=6000, output_tokens=4000))
        return turn


def make(tmp_path, model=None, **env):
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir()
    (knowledge / "career-profile-1.json").write_text("{}", encoding="utf-8")
    settings = RoadmapSettings(_env_file=None, ROADMAP_KNOWLEDGE_DIR=str(knowledge), **env)
    repo = FakeRepo()
    svc = RoadmapService(settings, repo, model_factory=lambda: model or MockRoadmapModel())
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_roadmap_service] = lambda: svc
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                               headers={"X-Session-Id": SESSION})
    return client, svc, repo


async def generate(client, svc, body=None):
    r = await client.post(f"/api/profiles/{PROFILE}/roadmaps", json=body or {})
    assert r.status_code == 202, r.text
    await svc.queue.join()
    job = await client.get(f"/api/roadmap-jobs/{r.json()['jobId']}")
    return job.json()


async def test_full_flow(tmp_path):
    client, svc, repo = make(tmp_path)
    async with client:
        assert (await client.get(f"/api/profiles/{PROFILE}/goal")).json() == {"goal": None}
        r = await client.post(f"/api/profiles/{PROFILE}/roadmaps", json={})
        assert r.status_code == 409 and r.json()["error"]["code"] == "GOAL_NOT_FOUND"

        r = await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        assert r.status_code == 200 and r.json()["goal"]["weeklyAvailability"] == "hours_2_to_5"

        job = await generate(client, svc)
        assert job["status"] == "succeeded" and job["roadmapId"] == 1 and job["reused"] is False

        roadmap = (await client.get(f"/api/profiles/{PROFILE}/roadmaps/current")).json()["roadmap"]
        assert roadmap["roadmapId"] == 1 and roadmap["nodes"][-1]["kind"] == "goal"
        assert roadmap["progress"]["percent"] == 0 and roadmap["edges"][0].keys() == {"from", "to", "optional"}

        item = roadmap["nodes"][0]["checklist"][0]["id"]
        r = await client.put(f"/api/profiles/{PROFILE}/roadmaps/1/tasks/{item}", json={"completed": True})
        assert r.status_code == 200 and r.json()["roadmap"]["progress"]["completedTasks"] == 1
        r = await client.put(f"/api/profiles/{PROFILE}/roadmaps/1/tasks/nope.9", json={"completed": True})
        assert r.json()["error"]["code"] == "TASK_NOT_FOUND"
    assert repo.runs == []  # the mock provider never records a paid run


async def test_identical_inputs_reuse_the_saved_roadmap(tmp_path):
    client, svc, repo = make(tmp_path)
    async with client:
        await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        first = await generate(client, svc)
        again = await generate(client, svc)
        forced = await generate(client, svc, {"force": True})
    assert again == {**first, "jobId": again["jobId"], "reused": True}
    assert forced["roadmapId"] == 2 and forced["reused"] is False


async def test_other_sessions_cannot_read_or_poll(tmp_path):
    client, svc, repo = make(tmp_path)
    async with client:
        await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        r = await client.post(f"/api/profiles/{PROFILE}/roadmaps", json={})
        job_id = r.json()["jobId"]
        await svc.queue.join()
        other = {"X-Session-Id": "someone-else"}
        assert (await client.get(f"/api/roadmap-jobs/{job_id}", headers=other)).status_code == 404
        assert (await client.get(f"/api/profiles/{PROFILE}/roadmaps/current", headers=other)).status_code == 404
        assert (await client.get(f"/api/profiles/{PROFILE}/goal", headers={"X-Session-Id": ""})).status_code == 400


async def test_missing_knowledge_fails_the_job(tmp_path):
    client, svc, repo = make(tmp_path)
    (tmp_path / "knowledge/career-profile-1.json").unlink()
    async with client:
        await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        job = await generate(client, svc)
    assert job["status"] == "failed" and job["error"]["code"] == "KNOWLEDGE_NOT_READY"


async def test_paid_provider_records_cost_and_respects_limits(tmp_path):
    client, svc, repo = make(tmp_path, model=PaidMock(), ROADMAP_DAILY_LIMIT_PER_PROFILE=1)
    async with client:
        await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        job = await generate(client, svc)
        assert job["status"] == "succeeded"
        assert repo.runs[0]["status"] == "succeeded" and repo.runs[0]["cost_usd"] == pytest.approx(0.104)

        r = await client.post(f"/api/profiles/{PROFILE}/roadmaps", json={"force": True})
        assert r.status_code == 429 and r.json()["error"]["code"] == "ROADMAP_LIMIT_REACHED"

        repo.runs.clear()
        repo.month_cost = 50.0
        r = await client.post(f"/api/profiles/{PROFILE}/roadmaps", json={})
        assert r.status_code == 429 and r.json()["error"]["code"] == "ROADMAP_BUDGET_REACHED"


async def test_goal_validation(tmp_path):
    client, svc, repo = make(tmp_path)
    async with client:
        r = await client.put(f"/api/profiles/{PROFILE}/goal", json={**GOAL_BODY, "weeklyAvailability": "lots"})
        assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_REQUEST"
        r = await client.put(f"/api/profiles/{PROFILE}/goal", json={**GOAL_BODY, "targetDate": "2020-01-01"})
        assert r.status_code == 400


async def test_ui_fields_and_step_actions(tmp_path):
    client, svc, repo = make(tmp_path)
    base = f"/api/profiles/{PROFILE}"
    async with client:
        await client.put(f"{base}/goal", json={**GOAL_BODY, "targetDate": "2027-01-18"})
        await generate(client, svc)
        roadmap = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        first = roadmap["nodes"][0]

        assert roadmap["layout"] == {"columns": 4, "rows": 2}
        assert all(1 <= n["position"]["row"] <= 6 and 1 <= n["position"]["column"] <= 4 for n in roadmap["nodes"])
        assert roadmap["nodes"][-1]["subtitle"] == "Target: Jan 18, 2027" and first["subtitle"] == "Quick check"
        assert roadmap["summary"]["durationLabel"] == "3 months"
        assert roadmap["summary"]["weeklyHours"] == {"min": 2.0, "max": 5.0}
        assert roadmap["summary"]["timeRemainingLabel"] == "3 months remaining"
        assert roadmap["progress"]["label"] == "0 of 9 tasks done"
        assert roadmap["currentNodeKey"] == roadmap["nextAction"]["nodeKey"] == first["key"]
        assert first["skill"]["profileLabel"] == "In your profile, level not assessed"
        assert any(e["optional"] for e in roadmap["edges"] if e["from"] == first["key"])

        steps = f"{base}/roadmaps/1/steps"
        r = await client.put(f"{steps}/{first['key']}", json={"status": "in_progress"})
        view = r.json()["roadmap"]
        assert view["nodes"][0]["status"] == "in_progress" and view["nodes"][0]["subtitle"] == "In progress"
        assert view["currentNodeKey"] == first["key"]

        r = await client.put(f"{steps}/{first['key']}", json={"status": "completed"})
        view = r.json()["roadmap"]
        assert view["nodes"][0]["status"] == "completed" and view["progress"]["completedTasks"] == 1
        # the first suggestion is done, so the best next step moves to the next unlocked step
        assert view["nextAction"]["nodeKey"] == view["nodes"][1]["key"]
        assert view["nextAction"]["text"].startswith("Next up: ")

        r = await client.put(f"{steps}/{first['key']}", json={"status": "not_started"})
        assert r.json()["roadmap"]["progress"]["completedTasks"] == 0
        r = await client.put(f"{steps}/goal", json={"status": "completed"})
        assert r.json()["error"]["code"] == "TASK_NOT_FOUND"
        r = await client.put(f"{steps}/{first['key']}", json={"status": "done"})
        assert r.status_code == 400
