"""Roadmap API + RoadmapRepository against a real, migrated PostgreSQL database.

Opt-in and destructive to its own rows: point it only at a disposable database that has
migrations 001-016 applied, for example a throwaway container:

    docker run -d --rm --name glowjob-roadmap-test -e POSTGRES_DB=glowjob -e POSTGRES_USER=glowjob \
        -e POSTGRES_PASSWORD=roadmap-test -p 55432:5432 pgvector/pgvector:0.8.7-pg16-bookworm
    (apply migrations, then)
    set ROADMAP_TEST_DATABASE=localhost:55432:glowjob:glowjob:roadmap-test
    pytest tests/test_roadmap_db.py

Uses the demo Agent Context fixture and the free mock model (plus a "paid" variant
that only pretends to bill tokens), so no model is called.
"""

import os
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
import psycopg
import pytest
from fastapi import FastAPI

from ai.roadmap.providers import MockRoadmapModel
from app.features.resume.config import CvSettings
from app.features.roadmap.config import RoadmapSettings
from app.features.roadmap.repository import RoadmapRepository
from app.features.roadmap.router import get_roadmap_service, router
from app.features.roadmap.service import RoadmapService

TARGET = os.getenv("ROADMAP_TEST_DATABASE")
pytestmark = pytest.mark.skipif(not TARGET, reason="set ROADMAP_TEST_DATABASE=host:port:db:user:password")
FIXTURE = Path(__file__).resolve().parents[2] / "ai/roadmap/fixtures/agent-context-demo-student.json"
SKILLS = {15: "Database Systems", 71: "SQL", 78: "Java", 85: "Docker", 87: "RAG", 91: "Python",
          97: "PostgreSQL", 103: "Apache Airflow", 218: "vector databases", 369: "JSON",
          420: "object-oriented design"}
GOAL = {"careerProfileId": 1, "readinessTimeframe": "three_months", "weeklyAvailability": "hours_2_to_5",
        "preferredLearningStyle": "hands_on_projects"}


class PaidMock(MockRoadmapModel):
    provider = "anthropic"

    def generate(self, compact):
        turn = super().generate(compact)
        turn.usage.add(SimpleNamespace(input_tokens=6000, output_tokens=4000))
        return turn


@pytest.fixture
def db():
    host, port, name, user, password = TARGET.split(":")
    settings = CvSettings(_env_file=None, DB_HOST=host, DB_PORT=int(port), DB_NAME=name, DB_USER=user,
                          DB_PASSWORD=password)
    session, profile_id = f"it-{uuid4().hex}", f"prf_it_{uuid4().hex}"
    with psycopg.connect(host=host, port=port, dbname=name, user=user, password=password) as c:
        c.execute("""INSERT INTO core.careers (career_id, slug, career_name) OVERRIDING SYSTEM VALUE
                     VALUES (1, 'data-engineer', 'Data Engineer') ON CONFLICT DO NOTHING""")
        c.execute("""INSERT INTO core.career_profiles (career_profile_id, career_id, slug, profile_name,
                     seniority_level) OVERRIDING SYSTEM VALUE
                     VALUES (1, 1, 'data-engineer', 'Data Engineer', 'general') ON CONFLICT DO NOTHING""")
        for skill_id, skill_name in SKILLS.items():
            c.execute("""INSERT INTO core.skills (skill_id, skill_name) OVERRIDING SYSTEM VALUE
                         VALUES (%s, %s) ON CONFLICT DO NOTHING""", (skill_id, skill_name))
        user_id = c.execute("""INSERT INTO app.users (auth_provider, auth_subject) VALUES ('anonymous', %s)
                               RETURNING user_id""", (session,)).fetchone()[0]
        c.execute("INSERT INTO app.user_profiles (user_id, profile_id) VALUES (%s, %s)", (user_id, profile_id))
    yield SimpleNamespace(settings=settings, session=session, profile_id=profile_id, user_id=user_id,
                          connect=lambda: psycopg.connect(host=host, port=port, dbname=name, user=user,
                                                          password=password))
    with psycopg.connect(host=host, port=port, dbname=name, user=user, password=password) as c:
        c.execute("DELETE FROM system.ai_runs WHERE user_id = %s", (user_id,))
        c.execute("DELETE FROM app.users WHERE user_id = %s", (user_id,))


def client_for(db, model, **env):
    settings = RoadmapSettings(_env_file=None, ROADMAP_CONTEXT_FIXTURE=str(FIXTURE), **env)
    svc = RoadmapService(settings, RoadmapRepository(db.settings), model_factory=lambda: model)
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_roadmap_service] = lambda: svc
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                               headers={"X-Session-Id": db.session})
    return client, svc


async def run_job(client, svc, db, body=None):
    r = await client.post(f"/api/profiles/{db.profile_id}/roadmaps", json=body or {})
    assert r.status_code == 202, r.text
    await svc.queue.join()
    return (await client.get(f"/api/roadmap-jobs/{r.json()['jobId']}")).json()


async def test_goal_generate_progress_and_versions(db):
    client, svc = client_for(db, MockRoadmapModel())
    base = f"/api/profiles/{db.profile_id}"
    async with client:
        r = await client.put(f"{base}/goal", json=GOAL)
        assert r.status_code == 200, r.text
        assert r.json()["goal"]["targetRoleTitle"] == "Data Engineer"
        r = await client.put(f"{base}/goal", json={**GOAL, "weeklyAvailability": "hours_5_to_10"})
        assert r.json()["goal"]["goalId"] == (await client.get(f"{base}/goal")).json()["goal"]["goalId"]

        job = await run_job(client, svc, db)
        assert job["status"] == "succeeded", job
        roadmap = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        assert roadmap["version"] == 1 and roadmap["status"] == "active"

        node = roadmap["nodes"][0]
        r = await client.put(f"{base}/roadmaps/{roadmap['roadmapId']}/tasks/{node['checklist'][0]['id']}",
                             json={"completed": True})
        assert r.status_code == 200, r.text
        assert r.json()["roadmap"]["progress"]["completedTasks"] == 1

        again = await run_job(client, svc, db)
        assert again["reused"] is True and again["roadmapId"] == job["roadmapId"]
        forced = await run_job(client, svc, db, {"force": True})
        assert forced["roadmapId"] != job["roadmapId"]
        latest = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        assert latest["version"] == 2 and latest["progress"]["completedTasks"] == 0

    with db.connect() as c:
        statuses = c.execute("SELECT version, status::text FROM app.roadmaps WHERE user_id = %s ORDER BY version",
                             (db.user_id,)).fetchall()
        assert statuses == [(1, "replaced"), (2, "active")]
        steps = c.execute("""SELECT count(*), count(*) FILTER (WHERE step_key IS NOT NULL AND citations IS NOT NULL)
                             FROM app.roadmap_steps s JOIN app.roadmaps r USING (roadmap_id)
                             WHERE r.user_id = %s""", (db.user_id,)).fetchone()
        assert steps[0] > 0 and steps[0] == steps[1]
        progress = c.execute("""SELECT status::text FROM app.user_roadmap_progress WHERE user_id = %s""",
                             (db.user_id,)).fetchall()
        assert progress and progress[0][0] in {"in_progress", "completed"}
        assert c.execute("SELECT count(*) FROM system.ai_runs WHERE user_id = %s", (db.user_id,)).fetchone()[0] == 0


async def test_paid_runs_are_recorded_and_limited(db):
    client, svc = client_for(db, PaidMock(), ROADMAP_DAILY_LIMIT_PER_PROFILE=1)
    base = f"/api/profiles/{db.profile_id}"
    async with client:
        await client.put(f"{base}/goal", json=GOAL)
        job = await run_job(client, svc, db)
        assert job["status"] == "succeeded", job
        r = await client.post(f"{base}/roadmaps", json={"force": True})
        assert r.status_code == 429 and r.json()["error"]["code"] == "ROADMAP_LIMIT_REACHED"
    with db.connect() as c:
        row = c.execute("""SELECT status, input_tokens, output_tokens, estimated_cost_usd
                           FROM system.ai_runs WHERE user_id = %s""", (db.user_id,)).fetchone()
        assert row[0] == "succeeded" and row[1:3] == (6000, 4000) and float(row[3]) == pytest.approx(0.104)
        cost = c.execute("""SELECT g.estimated_cost_usd, g.ai_run_id IS NOT NULL FROM app.roadmap_generations g
                            WHERE g.user_id = %s""", (db.user_id,)).fetchone()
        assert float(cost[0]) == pytest.approx(0.104) and cost[1]


async def test_other_session_is_rejected(db):
    client, svc = client_for(db, MockRoadmapModel())
    async with client:
        r = await client.get(f"/api/profiles/{db.profile_id}/goal", headers={"X-Session-Id": "not-the-owner"})
        assert r.status_code == 404 and r.json()["error"]["code"] == "PROFILE_NOT_FOUND"


async def test_step_actions_and_in_progress_state(db):
    client, svc = client_for(db, MockRoadmapModel())
    base = f"/api/profiles/{db.profile_id}"
    async with client:
        await client.put(f"{base}/goal", json=GOAL)
        assert (await run_job(client, svc, db))["status"] == "succeeded"
        roadmap = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        rid, first, second = roadmap["roadmapId"], roadmap["nodes"][0], roadmap["nodes"][1]
        assert roadmap["layout"]["rows"] == 2 and first["position"] == {"row": 1, "column": 1}

        r = await client.put(f"{base}/roadmaps/{rid}/steps/{first['key']}", json={"status": "in_progress"})
        assert r.json()["roadmap"]["nodes"][0]["status"] == "in_progress"
        # ticking then clearing the only task keeps the step "in progress" because the learner started it
        task = first["checklist"][0]["id"]
        await client.put(f"{base}/roadmaps/{rid}/tasks/{task}", json={"completed": True})
        r = await client.put(f"{base}/roadmaps/{rid}/tasks/{task}", json={"completed": False})
        assert r.json()["roadmap"]["nodes"][0]["status"] == "in_progress"

        r = await client.put(f"{base}/roadmaps/{rid}/steps/{second['key']}", json={"status": "completed"})
        view = r.json()["roadmap"]
        assert view["nodes"][1]["status"] == "completed"
        assert view["progress"]["completedTasks"] == len(second["checklist"])
        assert view["currentNodeKey"] == first["key"]  # the first step is still the one in progress

        r = await client.put(f"{base}/roadmaps/{rid}/steps/{second['key']}", json={"status": "not_started"})
        assert r.json()["roadmap"]["progress"]["completedTasks"] == 0
        r = await client.put(f"{base}/roadmaps/{rid}/steps/{second['key']}", json={"status": "skipped"})
        assert r.json()["roadmap"]["nodes"][1]["status"] == "skipped"
        r = await client.put(f"{base}/roadmaps/{rid}/steps/goal", json={"status": "completed"})
        assert r.json()["error"]["code"] == "TASK_NOT_FOUND"

    with db.connect() as c:
        rows = dict(c.execute(
            """SELECT s.step_key, p.status::text FROM app.user_roadmap_progress p
               JOIN app.roadmap_steps s USING (roadmap_step_id) WHERE p.user_id = %s""", (db.user_id,)).fetchall())
        assert rows[first["key"]] == "in_progress" and rows[second["key"]] == "skipped"

async def test_recent_activity_includes_completed_tasks_and_skills(db):
    client, svc = client_for(db, MockRoadmapModel())
    base = f"/api/profiles/{db.profile_id}"
    async with client:
        await client.put(f"{base}/goal", json=GOAL)
        assert (await run_job(client, svc, db))["status"] == "succeeded"
        view = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        node = next(n for n in view["nodes"] if not n["baselineComplete"] and len(n["checklist"]) > 1)
        task = node["checklist"][0]
        task_url = f"{base}/roadmaps/{view['roadmapId']}/tasks/{task['id']}"
        assert (await client.put(task_url, json={"completed": True})).status_code == 200
        events = (await client.get(f"{base}/progress-overview")).json()["activities"]
        task_event = next(e for e in events if e["id"].startswith("task-"))
        assert task_event["title"] == f"{task['label']} completed"
        assert task_event["nodeKey"] == node["key"] and task_event["occurredAt"]
        assert not any(e["id"].startswith("step-") for e in events)
        denied = await client.get(f"{base}/progress-overview", headers={"X-Session-Id": "other"})
        assert denied.status_code == 404
        await client.put(task_url, json={"completed": False})
        events = (await client.get(f"{base}/progress-overview")).json()["activities"]
        assert not any(e["id"].startswith("task-") for e in events)
        await client.put(f"{base}/roadmaps/{view['roadmapId']}/steps/{node['key']}", json={"status": "completed"})
        events = (await client.get(f"{base}/progress-overview")).json()["activities"]
        assert any(e["id"].startswith("step-") and e["nodeKey"] == node["key"] for e in events)
        assert any(e["id"].startswith("task-") for e in events)
