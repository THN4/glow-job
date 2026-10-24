"""TEMPORARY design-test database for the Assessments UI. Delete this file once the UI uses real data.

    python -m scripts.assessments.demo_db up      # start Postgres in Docker, migrate, seed demo data
    python -m scripts.assessments.demo_db up --no-bank   # same, but no questions: try on-demand generation
    python -m scripts.assessments.demo_db serve   # run the backend on :8787 against that database
    python -m scripts.assessments.demo_db reset   # wipe and seed again (same as up)
    python -m scripts.assessments.demo_db down    # remove the container and all its data

Runs from the repository root. Uses its own container and port, so it never touches the team
database or the test database. Seeding calls no AI model. The 16 document chunks of the roadmap
fixture (Airflow, RAG, Java) are loaded, so on-demand questions can be tried: set
ASSESSMENT_AI_GENERATION=gemini and GEMINI_API_KEY in backend/.env before `serve`.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTAINER, PORT, PASSWORD = "glowjob-assessments-demo", 55433, "assessments-demo"
SESSION, PROFILE = "demo-design-session", "prf_demo_design"
DB = {"DB_HOST": "localhost", "DB_PORT": str(PORT), "DB_NAME": "glowjob", "DB_USER": "glowjob", "DB_PASSWORD": PASSWORD}

# core.skills rows used by the seed bank, the mock roadmap and the demo profile
SKILLS = {71: "SQL", 78: "Java", 85: "Docker", 87: "RAG", 91: "Python", 94: "Git", 103: "Apache Airflow"}
FIXTURE = ROOT / "ai/roadmap/fixtures/agent-context-demo-student.json"
# The demo profile: (skill_id, level, basis). Mixed on purpose so every card state shows.
PROFILE_SKILLS = [(91, "beginner", "explicit"), (71, "intermediate", "inferred"), (85, "unknown", "unknown"),
                  (94, "unknown", "unknown"), (103, "unknown", "unknown")]

BROWSER_SNIPPET = (f"localStorage.setItem('glowjob.anonymous.sessionId', '{SESSION}'); "
                   f"localStorage.setItem('glowjob.anonymous.profileId', '{PROFILE}'); location.reload()")


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def psql(*args: str) -> subprocess.CompletedProcess:
    return run(["docker", "exec", CONTAINER, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "glowjob", "-d", "glowjob",
                *args])


def start() -> None:
    run(["docker", "rm", "-f", CONTAINER])
    started = run(["docker", "run", "-d", "--name", CONTAINER, "-e", "POSTGRES_DB=glowjob", "-e", "POSTGRES_USER=glowjob",
                   "-e", f"POSTGRES_PASSWORD={PASSWORD}", "-p", f"{PORT}:5432", "pgvector/pgvector:0.8.7-pg16-bookworm"])
    if started.returncode:
        sys.exit("Could not start Postgres. Is Docker running?\n" + started.stderr.strip())
    for _ in range(40):
        if run(["docker", "exec", CONTAINER, "pg_isready", "-U", "glowjob", "-d", "glowjob"]).returncode == 0:
            break
        time.sleep(2)
    time.sleep(4)  # the image restarts the server once after its first init
    psql("-c", "CREATE SCHEMA IF NOT EXISTS system; CREATE TABLE IF NOT EXISTS system.schema_migrations "
               "(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())")
    files = {p.name: p for d in (ROOT / "data-pipeline/migrations/versions", ROOT / "migrations/versions")
             for p in d.glob("*.sql")}
    for name in sorted(files):
        run(["docker", "cp", str(files[name]), f"{CONTAINER}:/tmp/m.sql"])
        done = psql("-1", "-f", "/tmp/m.sql", "-c", f"INSERT INTO system.schema_migrations (version) VALUES ('{name}')")
        if done.returncode:
            sys.exit(f"Migration {name} failed: {done.stderr.strip()}")
    print(f"Postgres ready on localhost:{PORT}, migrations {min(files)[:3]}-{max(files)[:3]} applied")


def seed_knowledge(c) -> int:
    """The fixture's evidence chunks, with their real IDs, so question quotes can be checked."""
    import json

    from psycopg.types.json import Jsonb

    registry = json.loads(FIXTURE.read_text(encoding="utf-8"))["evidence_registry"]
    positions: dict[int, int] = {}
    for e in registry:
        c.execute("""INSERT INTO knowledge.knowledge_sources (source_id, source_type, title, source_url)
                     OVERRIDING SYSTEM VALUE VALUES (%s, 'documentation', %s, %s) ON CONFLICT DO NOTHING""",
                  (e["source_id"], e["title"], e["source_url"]))
        positions[e["source_id"]] = positions.get(e["source_id"], -1) + 1
        c.execute("""INSERT INTO knowledge.knowledge_chunks (chunk_id, source_id, chunk_index, content, metadata)
                     OVERRIDING SYSTEM VALUE VALUES (%s, %s, %s, %s, %s)""",
                  (e["chunk_id"], e["source_id"], positions[e["source_id"]], e["content"],
                   Jsonb({"page_title": e["title"], "heading_path": e["heading_path"]})))
        for skill_id in e["used_by_skill_ids"]:
            c.execute("INSERT INTO knowledge.knowledge_chunk_skills (chunk_id, skill_id) VALUES (%s, %s)",
                      (e["chunk_id"], skill_id))
    return len(registry)


def seed(with_bank: bool = True) -> None:
    import psycopg

    from ai.assessments.bank import Bank
    from scripts.assessments.load_bank import load

    with psycopg.connect(host="localhost", port=PORT, dbname="glowjob", user="glowjob", password=PASSWORD) as c:
        for skill_id, name in SKILLS.items():
            c.execute("INSERT INTO core.skills (skill_id, skill_name) OVERRIDING SYSTEM VALUE VALUES (%s, %s)",
                      (skill_id, name))
        user_id = c.execute("INSERT INTO app.users (auth_provider, auth_subject) VALUES ('anonymous', %s) "
                            "RETURNING user_id", (SESSION,)).fetchone()[0]
        c.execute("INSERT INTO app.user_profiles (user_id, profile_id) VALUES (%s, %s)", (user_id, PROFILE))
        for skill_id, level, basis in PROFILE_SKILLS:
            c.execute("""INSERT INTO app.user_skills (user_id, skill_id, raw_skill_name, match_status, proficiency_level,
                         proficiency_basis, user_confirmed) VALUES (%s, %s, %s, 'matched', %s, %s, true)""",
                      (user_id, skill_id, SKILLS[skill_id], level, basis))
        chunks = seed_knowledge(c)
        bank = Bank.model_validate_json((ROOT / "ai/assessments/seed/demo_bank.json").read_text(encoding="utf-8"))
        if not with_bank:
            bank = bank.model_copy(update={"items": []})  # keep the self-check statements
        counts = load(c, bank, skip_source_check=False, dry_run=False)
    print(f"Seeded profile {PROFILE} ({len(PROFILE_SKILLS)} skills), {chunks} document chunks, "
          f"{counts['loaded']} questions, {counts['statements']} self-check statements")
    asyncio.run(seed_history())


async def seed_history() -> None:
    """A little activity, made through the real service so the records look like the UI made them."""
    sys.path.insert(0, str(ROOT / "backend"))
    from app.features.assessments.repository import AssessmentRepository
    from app.features.assessments.service import AssessmentService
    from app.features.resume.config import CvSettings

    svc = AssessmentService(AssessmentRepository(CvSettings(**DB)))
    await svc.quick_question(PROFILE, SESSION, skill_id=94, level="intermediate", answer="I use it on my own",
                             entry_point="roadmap", step_key=None)
    started = await svc.start_level_check(PROFILE, SESSION, 71, "assessments")
    answers = {str(s["id"]): "no" if s["level"] == "advanced" else "yes" for s in started["statements"]}
    await svc.submit_self_check(PROFILE, SESSION, started["assessmentId"], answers)
    await svc.decide_level_check(PROFILE, SESSION, started["assessmentId"], "declined")
    print("Seeded activity: Git quick question (kept), SQL self-check (not kept)")


def serve() -> None:
    env = {**os.environ, **DB, "RESUME_EXTRACTOR": "mock",
           "PYTHONPATH": os.pathsep.join([str(ROOT), str(ROOT / "data-pipeline")])}
    print("Backend on http://localhost:8787 using the demo database. Ctrl+C to stop.")
    print("On-demand questions: set ASSESSMENT_AI_GENERATION=gemini and GEMINI_API_KEY in backend/.env to try them.")
    subprocess.run([sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8787", "--reload"],
                   cwd=ROOT / "backend", env=env)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["up", "reset", "serve", "down"])
    parser.add_argument("--no-bank", action="store_true", help="seed no questions (try on-demand generation)")
    args = parser.parse_args()
    command = args.command
    if command in {"up", "reset"}:
        start()
        seed(with_bank=not args.no_bank)
        print("\nNext:\n  1. python -m scripts.assessments.demo_db serve\n  2. cd frontend && npm run dev"
              "\n  3. In the browser console on http://localhost:5173 paste:\n     " + BROWSER_SNIPPET +
              "\n  4. Open /app/assessments, or a Roadmap step (Airflow has a step check)")
    elif command == "serve":
        serve()
    else:
        run(["docker", "rm", "-f", CONTAINER])
        print("Demo database removed. In the browser you can clear the two glowjob.anonymous.* keys.")


if __name__ == "__main__":
    main()
