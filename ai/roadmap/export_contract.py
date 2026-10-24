"""Write the frontend contract: JSON schema and example responses for every UI state.

Examples come from the free mock model on the demo Agent Context, so they always match
the code. Regenerate after changing ai/roadmap/contracts.py:

    python -m ai.roadmap.export_contract
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from ai.roadmap.generate import generate_roadmap, prepare
from ai.roadmap.providers import MockRoadmapModel
from ai.roadmap.contracts import RoadmapView
from ai.roadmap.view import apply_progress
from rag.context.agent_models import AgentContext

ROOT = Path(__file__).resolve().parents[2]
PLAN_DATE = date(2026, 10, 19)
FIXTURE = ROOT / "ai/roadmap/fixtures/agent-context-demo-student.json"
OUT = ROOT / "shared/contracts/api/roadmap"


def error(code: str, message: str, retryable: bool = False) -> dict:
    return {"error": {"code": code, "message": message, "retryable": retryable}}


def main() -> None:
    context = AgentContext.model_validate_json(FIXTURE.read_bytes())
    model = MockRoadmapModel()
    view = generate_roadmap(context, model, prepared=prepare(context, model, today=PLAN_DATE)).view
    view = view.model_copy(update={"roadmap_id": 1, "version": 1, "status": "active",
                                   "generated_at": "2026-10-19T09:00:00+00:00"})
    view = apply_progress(view, completed_tasks=set(), skipped_steps=set(), today=PLAN_DATE)
    first, second = view.nodes[0], view.nodes[1]
    in_progress = apply_progress(view, completed_tasks={first.checklist[0].id}, skipped_steps=set(),
                                 started_steps={second.key}, today=PLAN_DATE)

    def dump(model_view: RoadmapView) -> dict:
        return {"roadmap": model_view.model_dump(mode="json", by_alias=True)}

    goal = {"goalId": 2, "careerId": 1, "careerProfileId": 1, "targetRoleTitle": "Data Engineer",
            "readinessTimeframe": "three_months", "targetDate": "2027-01-18",
            "weeklyAvailability": "hours_2_to_5", "availableHoursPerWeek": None,
            "preferredLearningStyle": "hands_on_projects",
            "additionalContext": "Preparing for a data engineering internship.",
            "updatedAt": "2026-10-19T08:55:00+00:00"}
    files = {
        "roadmap-view.schema.json": RoadmapView.model_json_schema(by_alias=True),
        "examples/goal.get.empty.json": {"goal": None},
        "examples/goal.put.request.json": {k: goal[k] for k in (
            "careerProfileId", "readinessTimeframe", "targetDate", "weeklyAvailability",
            "preferredLearningStyle", "additionalContext")},
        "examples/goal.json": {"goal": goal},
        "examples/job.queued.json": {"jobId": "rmj_example", "status": "queued", "stage": "queued",
                                     "roadmapId": None, "reused": False},
        "examples/job.running.json": {"jobId": "rmj_example", "status": "running", "stage": "generating",
                                      "roadmapId": None, "reused": False},
        "examples/job.succeeded.json": {"jobId": "rmj_example", "status": "succeeded", "stage": "done",
                                        "roadmapId": 1, "reused": False},
        "examples/job.failed.json": {"jobId": "rmj_example", "status": "failed", "stage": "generating",
                                     "roadmapId": None, "reused": False,
                                     **error("ROADMAP_GENERATION_FAILED",
                                             "The roadmap could not be generated. Please try again.", True)},
        "examples/task.put.request.json": {"completed": True},
        "examples/step.put.request.json": {"status": "completed"},
        "examples/roadmap.current.json": dump(view),
        "examples/roadmap.in-progress.json": dump(in_progress),
        "examples/error.goal-not-found.json": error("GOAL_NOT_FOUND", "Set a career goal before creating a roadmap."),
        "examples/error.roadmap-not-found.json": error("ROADMAP_NOT_FOUND", "No roadmap was found."),
        "examples/error.limit-reached.json": error(
            "ROADMAP_LIMIT_REACHED", "Today's roadmap limit has been reached. Try again tomorrow."),
        "examples/error.budget-reached.json": error(
            "ROADMAP_BUDGET_REACHED", "Roadmap generation is paused for the rest of this month."),
        "examples/error.knowledge-not-ready.json": error(
            "KNOWLEDGE_NOT_READY", "Learning content for this career is not ready yet."),
    }
    for name, content in files.items():
        path = OUT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
