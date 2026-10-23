"""Assessments against a real, migrated PostgreSQL (migrations 001-018). Opt-in, like
test_roadmap_db.py: set ROADMAP_TEST_DATABASE=host:port:db:user:password for a disposable database.

Covers the SQL the in-memory tests cannot: loading the bank, step checks on a saved roadmap
(verified tasks in the roadmap view), keeping a level, the overlay surviving a profile save,
Agent Context reading the new level basis, the new constraints, and on-demand question generation
(one model run per chunk, reuse, daily cap, back-off) with a fake model.
"""

import asyncio
import importlib.util
import os
import random
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
import psycopg
import pytest
from fastapi import FastAPI

from ai.assessments.bank import Bank
from ai.roadmap.providers import MockRoadmapModel
from app.features.assessments.repository import AssessmentRepository
from app.features.assessments.router import get_assessment_service, router as assessments_router
from app.features.assessments.service import AssessmentService
from app.features.resume.config import CvSettings
from app.features.roadmap.config import RoadmapSettings
from app.features.roadmap.repository import RoadmapRepository
from app.features.roadmap.router import get_roadmap_service, router as roadmap_router
from app.features.roadmap.service import RoadmapService

TARGET = os.getenv("ROADMAP_TEST_DATABASE")
pytestmark = pytest.mark.skipif(not TARGET, reason="set ROADMAP_TEST_DATABASE=host:port:db:user:password")
ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "ai/roadmap/fixtures/agent-context-demo-student.json"
SKILLS = {15: "Database Systems", 71: "SQL", 78: "Java", 85: "Docker", 87: "RAG", 91: "Python", 94: "Git",
          97: "PostgreSQL", 103: "Apache Airflow", 218: "vector databases", 369: "JSON", 420: "object-oriented design"}


def _load_bank_module():
    spec = importlib.util.spec_from_file_location("load_bank", ROOT / "scripts/assessments/load_bank.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def db():
    host, port, name, user, password = TARGET.split(":")
    conn_args = dict(host=host, port=port, dbname=name, user=user, password=password)
    settings = CvSettings(_env_file=None, DB_HOST=host, DB_PORT=int(port), DB_NAME=name, DB_USER=user,
                          DB_PASSWORD=password)
    session, profile_id = f"it-{uuid4().hex}", f"prf_it_{uuid4().hex}"
    with psycopg.connect(**conn_args) as c:
        c.execute("""INSERT INTO core.careers (career_id, slug, career_name) OVERRIDING SYSTEM VALUE
                     VALUES (1, 'data-engineer', 'Data Engineer') ON CONFLICT DO NOTHING""")
        c.execute("""INSERT INTO core.career_profiles (career_profile_id, career_id, slug, profile_name, seniority_level)
                     OVERRIDING SYSTEM VALUE VALUES (1, 1, 'data-engineer', 'Data Engineer', 'general')
                     ON CONFLICT DO NOTHING""")
        for skill_id, skill_name in SKILLS.items():
            c.execute("INSERT INTO core.skills (skill_id, skill_name) OVERRIDING SYSTEM VALUE VALUES (%s, %s) "
                      "ON CONFLICT DO NOTHING", (skill_id, skill_name))
        with c.transaction():
            _load_bank_module().load(c, Bank.model_validate_json((ROOT / "ai/assessments/seed/demo_bank.json").read_bytes()),
                                     skip_source_check=True, dry_run=False)
        user_id = c.execute("INSERT INTO app.users (auth_provider, auth_subject) VALUES ('anonymous', %s) "
                            "RETURNING user_id", (session,)).fetchone()[0]
        c.execute("INSERT INTO app.user_profiles (user_id, profile_id) VALUES (%s, %s)", (user_id, profile_id))
    yield SimpleNamespace(settings=settings, session=session, profile_id=profile_id, user_id=user_id,
                          connect=lambda: psycopg.connect(**conn_args))
    with psycopg.connect(**conn_args) as c:
        c.execute("DELETE FROM app.users WHERE user_id = %s", (user_id,))


def client_for(db):
    roadmap_repo = RoadmapRepository(db.settings)
    assess = AssessmentService(AssessmentRepository(db.settings, roadmap_repo), rng=random.Random(3))
    roadmaps = RoadmapService(RoadmapSettings(_env_file=None, ROADMAP_CONTEXT_FIXTURE=str(FIXTURE)), roadmap_repo,
                              model_factory=MockRoadmapModel)
    app = FastAPI()
    app.include_router(roadmap_router, prefix="/api")
    app.include_router(assessments_router, prefix="/api")
    app.dependency_overrides[get_assessment_service] = lambda: assess
    app.dependency_overrides[get_roadmap_service] = lambda: roadmaps
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                               headers={"X-Session-Id": db.session})
    return client, roadmaps


def answer_key(db, item_ids):
    with db.connect() as c:
        return dict(c.execute("SELECT item_id, answer_index FROM app.assessment_items WHERE item_id = ANY(%s)",
                              (item_ids,)).fetchall())


async def test_step_check_on_saved_roadmap_ticks_verified_tasks(db):
    client, roadmaps = client_for(db)
    base = f"/api/profiles/{db.profile_id}"
    async with client:
        await client.put(f"{base}/goal", json={"careerProfileId": 1, "readinessTimeframe": "three_months",
                                               "weeklyAvailability": "hours_2_to_5",
                                               "preferredLearningStyle": "hands_on_projects"})
        job = await client.post(f"{base}/roadmaps", json={})
        await roadmaps.queue.join()
        roadmap = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        airflow = next(n for n in roadmap["nodes"] if n["key"] == "apache-airflow")
        assert [i["questionCount"] for i in airflow["checklist"]] == [1, 1, 2, 0]

        r = await client.post(f"{base}/assessments/step-checks",
                              json={"stepKey": "apache-airflow", "roadmapId": roadmap["roadmapId"]})
        assert r.status_code == 201, r.text
        started = r.json()
        key = answer_key(db, [q["itemId"] for q in started["questions"]])
        answers = [{"itemId": q["itemId"], "choice": key[q["itemId"]]} for q in started["questions"]]
        result = (await client.post(f"{base}/assessments/{started['assessmentId']}/finish", json={"answers": answers})).json()
        assert result["verifiedCount"] == 3
        await client.post(f"{base}/assessments/{started['assessmentId']}/apply", json={"apply": True})

        roadmap = (await client.get(f"{base}/roadmaps/current")).json()["roadmap"]
        items = next(n for n in roadmap["nodes"] if n["key"] == "apache-airflow")["checklist"]
        assert [(i["completed"], i["verified"]) for i in items] == [(True, True)] * 3 + [(False, False)]
        # unticking by hand removes the verification
        r = await client.put(f"{base}/roadmaps/{roadmap['roadmapId']}/tasks/apache-airflow.1", json={"completed": False})
        assert r.json()["roadmap"]["nodes"][1]["checklist"][0]["verified"] is False
    assert job.status_code == 202


async def test_kept_level_survives_profile_save_and_reaches_agent_context(db):
    client, _ = client_for(db)
    base = f"/api/profiles/{db.profile_id}/assessments"
    async with client:
        start = (await client.post(f"{base}/level-checks", json={"skillId": 103})).json()
        answers = {str(s["id"]): "yes" if s["level"] == "beginner" else "no" for s in start["statements"]}
        body = (await client.post(f"{base}/{start['assessmentId']}/self-check", json={"answers": answers})).json()
        while "question" in body:
            item = body["question"]["itemId"]
            body = (await client.post(f"{base}/{start['assessmentId']}/answers",
                                      json={"itemId": item, "choice": answer_key(db, [item])[item]})).json()
        assert body["result"]["level"] == "advanced"
        await client.post(f"{base}/{start['assessmentId']}/decision", json={"decision": "accepted"})
        r = await client.post(f"{base}/quick", json={"skillId": 85, "level": "beginner", "answer": "I can run containers"})
        assert r.status_code == 201

        # A later self-rating is retained in history without replacing quiz evidence.
        r = await client.post(f"{base}/quick", json={"skillId": 103, "level": "beginner", "answer": "Just starting"})
        assert r.json()["profileLevel"] == {"skillId": 103, "level": "advanced", "basis": "assessed"}

    def skill_rows():
        with db.connect() as c:
            return {r[0]: r[1:] for r in c.execute(
                """SELECT u.skill_id, u.proficiency_level::text, u.proficiency_basis, u.source,
                          (SELECT count(*) FROM app.user_skill_evidence e WHERE e.user_skill_id = u.user_skill_id
                           AND e.evidence_type = 'assessment')
                   FROM app.user_skills u WHERE u.user_id = %s""", (db.user_id,)).fetchall()}

    assert skill_rows() == {103: ("advanced", "assessed", "assessment", 1), 85: ("beginner", "self_reported", "assessment", 1)}

    # Saving the profile recreates app.user_skills from the profile JSON; kept levels come back.
    from app.features.resume.profiles import DatabaseProfilesRepo
    from app.features.resume.storage import StoredProfile
    from src.resume.schemas.cv_extraction import empty_profile

    profile = empty_profile().model_dump(mode="json", by_alias=True)
    DatabaseProfilesRepo(db.settings)._put(StoredProfile(db.profile_id, db.session, profile,
                                                         "2026-10-22T00:00:00+00:00", "2026-10-22T00:00:00+00:00"))
    assert skill_rows() == {103: ("advanced", "assessed", "assessment", 1), 85: ("beginner", "self_reported", "assessment", 1)}

    from rag.context.repository import load_inputs
    with db.connect() as c:
        inputs = load_inputs(c, career_profile_id=1, profile_id=db.profile_id)
    bases = {s.skill_id: s.proficiency_basis for s in inputs.user.confirmed_skills}
    assert bases == {103: "assessed", 85: "self_reported"}


async def test_overview_and_constraints(db):
    client, _ = client_for(db)
    async with client:
        page = (await client.get(f"/api/profiles/{db.profile_id}/assessments")).json()
    airflow = next(x for x in page["levelChecks"] if x["skillId"] == 103)
    assert airflow == {"skillId": 103, "name": "Apache Airflow", "inProfile": False, "level": None, "basis": None,
                       "hasQuiz": True, "reason": "Not in your profile yet"}
    with db.connect() as c, pytest.raises(psycopg.errors.CheckViolation):
        c.execute("INSERT INTO app.user_skills (user_id, skill_id, raw_skill_name, match_status, proficiency_basis) "
                  "VALUES (%s, 91, 'Python', 'matched', 'guessed')", (db.user_id,))


GEN_CHUNK, GEN_SOURCE = 990001, 990001


def _seed_chunk(db, chunk_id=GEN_CHUNK):
    with db.connect() as c:
        c.execute("""INSERT INTO knowledge.knowledge_sources (source_id, source_type, title) OVERRIDING SYSTEM VALUE
                     VALUES (%s, 'documentation', 'Docker overview') ON CONFLICT DO NOTHING""", (GEN_SOURCE,))
        c.execute("""INSERT INTO knowledge.knowledge_chunks (chunk_id, source_id, chunk_index, content)
                     OVERRIDING SYSTEM VALUE VALUES (%s, %s, %s, %s)""",
                  (chunk_id, GEN_SOURCE, chunk_id - GEN_CHUNK,
                   "A container is a runnable instance of an image. You can create, start, stop, move, or delete a "
                   "container using the Docker API or CLI."))
        c.execute("INSERT INTO knowledge.knowledge_chunk_skills (chunk_id, skill_id) VALUES (%s, 85)", (chunk_id,))


@pytest.fixture
def gen_db(db):
    yield db
    with db.connect() as c:
        c.execute("DELETE FROM app.assessment_items WHERE chunk_id >= %s", (GEN_CHUNK,))
        c.execute("DELETE FROM app.assessment_generations WHERE chunk_id >= %s", (GEN_CHUNK,))
        c.execute("DELETE FROM knowledge.knowledge_chunks WHERE source_id = %s", (GEN_SOURCE,))
        c.execute("DELETE FROM knowledge.knowledge_sources WHERE source_id = %s", (GEN_SOURCE,))


class FakeModel:
    def __init__(self, stem="In Docker, what is a container?", fail=False):
        self.calls, self.stem, self.fail = 0, stem, fail

    def __call__(self, prompt: str) -> str:
        import json
        import time

        self.calls += 1
        time.sleep(0.2)  # long enough for a second request to wait on the lock
        if self.fail:
            raise RuntimeError("429")
        if prompt.startswith("You write"):
            return json.dumps({"items": [{"stem": self.stem, "level": "beginner", "answer_index": 1,
                                          "options": ["A stored image", "A runnable instance of an image",
                                                      "A registry", "A Dockerfile"],
                                          "quote": "A container is a runnable instance of an image."}]})
        return json.dumps({"answer_index": 1})


async def test_on_demand_questions_for_a_step_check(gen_db):
    from app.features.assessments.generator import QuestionGenerator

    _seed_chunk(gen_db)
    model = FakeModel()
    generator = QuestionGenerator(gen_db.settings, model, model="fake", daily_limit=50, timeout_s=10)
    assess = AssessmentService(AssessmentRepository(gen_db.settings), rng=random.Random(1), generator=generator)
    tasks = [{"task_id": "docker-platform", "label": "Study: Containers", "chunk_ids": [GEN_CHUNK]}]
    started = await assess.start_step_check(gen_db.profile_id, gen_db.session, step_key="docker", skill_id=85,
                                            roadmap_id=None, tasks=tasks, entry_point="roadmap")
    assert [q["stem"] for q in started["questions"]] == ["In Docker, what is a container?"]
    assert model.calls == 2  # write + blind answer

    # two requests at once for a new chunk: one model run, both get the question
    _seed_chunk(gen_db, GEN_CHUNK + 1)
    model.stem = "What can you do with a Docker container?"
    tasks2 = [{"task_id": "docker-cli", "label": "Study: The CLI", "chunk_ids": [GEN_CHUNK + 1]}]
    runs = await asyncio.gather(*[assess.start_step_check(gen_db.profile_id, gen_db.session, step_key="docker",
                                                          skill_id=85, roadmap_id=None, tasks=tasks2, entry_point=None)
                                  for _ in range(2)])
    assert model.calls == 4 and all(len(r["questions"]) == 1 for r in runs)
    with gen_db.connect() as c:
        rows = c.execute("SELECT status, generated_by FROM app.assessment_items WHERE chunk_id >= %s",
                         (GEN_CHUNK,)).fetchall()
        assert rows == [("provisional", "gemini-on-demand")] * 2
        assert c.execute("SELECT count(*) FROM app.assessment_generations WHERE chunk_id >= %s AND outcome = 'created'",
                         (GEN_CHUNK,)).fetchone()[0] == 2
        # level checks ignore provisional questions, and an approved one replaces them in step checks
        assert AssessmentRepository(gen_db.settings).level_item_ids(85) == {}
        c.execute("UPDATE app.assessment_items SET status = 'approved' WHERE chunk_id = %s", (GEN_CHUNK,))


async def test_on_demand_generation_backs_off_and_respects_the_cap(gen_db):
    from app.features.assessments.generator import QuestionGenerator

    _seed_chunk(gen_db)
    failing = FakeModel(fail=True)
    generator = QuestionGenerator(gen_db.settings, failing, model="fake", daily_limit=50, timeout_s=10)
    assert await generator.fill(85, [GEN_CHUNK]) == 0
    assert await generator.fill(85, [GEN_CHUNK]) == 0
    assert failing.calls == 1  # a failed run is not retried within the hour
    with gen_db.connect() as c:
        assert c.execute("SELECT outcome FROM app.assessment_generations WHERE chunk_id = %s",
                         (GEN_CHUNK,)).fetchone()[0] == "failed"
        today = c.execute("SELECT count(*) FROM app.assessment_generations "
                          "WHERE started_at >= date_trunc('day', now())").fetchone()[0]

    _seed_chunk(gen_db, GEN_CHUNK + 1)
    model = FakeModel()
    capped = QuestionGenerator(gen_db.settings, model, model="fake", daily_limit=today, timeout_s=10)
    assert await capped.fill(85, [GEN_CHUNK + 1]) == 0 and model.calls == 0
