"""Roadmap core (ai/roadmap): budget, compaction, validation, repair, view and Claude call shape.

No test calls a real model; Claude is replaced by a fake streaming client.
"""

from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from ai.roadmap import layout
from ai.roadmap.compact import compact_context, planning_budget
from ai.roadmap.contracts import RoadmapDraft
from ai.roadmap.cost import Pricing, estimate_cost
from ai.roadmap.generate import GenerationFailed, generate_roadmap, prepare
from ai.roadmap.providers import ClaudeRoadmapModel, GeminiRoadmapModel, MockRoadmapModel, ModelError, ModelTurn, Usage, output_schema
from ai.roadmap.validate import validate_draft
from ai.roadmap.view import apply_progress
from rag.context.agent_models import AgentContext

FIXTURE = Path(__file__).resolve().parents[2] / "ai/roadmap/fixtures/agent-context-demo-student.json"
TODAY = date(2026, 10, 19)
AIRFLOW, RAG, JAVA, DOCKER = 103, 87, 78, 85


@pytest.fixture(scope="module")
def context() -> AgentContext:
    return AgentContext.model_validate_json(FIXTURE.read_bytes())


def draft(**overrides) -> RoadmapDraft:
    """A small valid draft: Docker check -> Airflow -> project; RAG and Java deferred."""
    base = {
        "title": "Data Engineer roadmap", "overview": "Airflow first.", "planning_note": "Fits 2-5 h/week.",
        "steps": [
            {"key": "check-docker", "kind": "foundation_check", "skill_id": DOCKER, "title": "Check Docker",
             "summary": "Confirm Docker.", "why": ["Airflow tutorial uses Docker Compose."], "hours_min": 1,
             "hours_max": 2, "depends_on": [], "tasks": [
                 {"title": "Run a container", "detail": "Try docker run.", "task_kind": "check", "citations": []}]},
            {"key": "airflow", "kind": "skill", "skill_id": AIRFLOW, "title": "Learn Airflow",
             "summary": "DAGs and operators.", "why": ["Required in 3 job posts."], "hours_min": 10,
             "hours_max": 16, "depends_on": ["check-docker"], "tasks": [
                 {"title": "What is a Dag?", "detail": "Read the intro.", "task_kind": "learn", "citations": [
                     {"chunk_id": 2, "quote": "a Dag is a collection of tasks organized in a way that reflects their relationships"}]}]},
            {"key": "project", "kind": "project", "skill_id": None, "title": "Build a pipeline",
             "summary": "Small ETL DAG.", "why": ["Portfolio evidence."], "hours_min": 4, "hours_max": 8,
             "depends_on": ["airflow"], "tasks": [
                 {"title": "Build it", "detail": "Push to GitHub.", "task_kind": "practice", "citations": []}]},
        ],
        "next_action": {"step_key": "check-docker", "text": "Run docker --version."},
        "deferred": [{"skill_id": RAG, "reason_code": "OUTSIDE_TIME_BUDGET", "note": "Later."},
                     {"skill_id": JAVA, "reason_code": "CONTENT_OUTLINE_ONLY", "note": "Later."}],
        "confirmations": [{"skill_id": DOCKER, "question": "How comfortable are you with Docker?"}],
    }
    base.update(overrides)
    return RoadmapDraft.model_validate(base)


def test_budget_uses_saved_range_and_target_date(context):
    budget = planning_budget(context, TODAY)
    assert (budget.weekly_min, budget.weekly_max, budget.weeks) == (2.0, 5.0, 13)
    assert (budget.total_min, budget.total_max) == (26, 65)


def test_compact_context_drops_dependency_only_sources(context):
    compact = compact_context(context, planning_budget(context, TODAY))
    sent = {source["chunk_id"] for source in compact["sources"]}
    dependency_only = {e.chunk_id for e in context.evidence_registry if "learning_content" not in e.usage_roles}
    assert dependency_only and not sent & dependency_only
    assert len(compact["learner"]["profile_evidence_excerpts"]) == 1  # five identical excerpts deduplicated


def global_docker_prerequisite(context):
    foundations = []
    for foundation in context.foundation_mentions:
        if foundation.skill_id == DOCKER:
            relationships = tuple(
                relationship.model_copy(update={
                    "dependency_type": "prerequisite",
                    "runtime_role": "global_ordering",
                    "blocks_unconditional_progress": True,
                })
                for relationship in foundation.relationships
            )
            foundation = foundation.model_copy(update={"relationships": relationships})
        foundations.append(foundation)
    return context.model_copy(update={"foundation_mentions": tuple(foundations)})


def test_global_prerequisite_is_sent_and_enforced(context):
    required = global_docker_prerequisite(context)
    compact = compact_context(required, planning_budget(required, TODAY))
    docker = next(f for f in compact["foundations"] if f["skill_id"] == DOCKER)
    assert docker["relationships"][0]["runtime_role"] == "global_ordering"
    assert docker["relationships"][0]["blocks_unconditional_progress"] is True

    valid = validate_draft(draft(), required, planning_budget(required, TODAY))
    assert valid.fatal == []
    unordered = draft()
    unordered.steps[1].depends_on = []
    rejected = validate_draft(unordered, required, planning_budget(required, TODAY))
    assert any("must depend on prerequisite Docker" in issue for issue in rejected.fatal)

    missing = draft(steps=draft().steps[1:])
    missing.steps[0].depends_on = []
    rejected = validate_draft(missing, required, planning_budget(required, TODAY))
    assert any("needs a prerequisite check for Docker" in issue for issue in rejected.fatal)

    model = MockRoadmapModel()
    result = generate_roadmap(required, model, prepared=prepare(required, model, today=TODAY))
    assert any(edge.from_ == "check-docker" and edge.to == "apache-airflow"
               and edge.optional is False for edge in result.view.edges), result.view.edges
    skipped = apply_progress(result.view, completed_tasks=set(), skipped_steps={"check-docker"}, today=TODAY)
    assert skipped.next_action.node_key == "check-docker"
    other_tasks = {item.id for node in result.view.nodes if node.key != "check-docker"
                   for item in node.checklist}
    blocked = apply_progress(result.view, completed_tasks=other_tasks,
                             skipped_steps={"check-docker"}, today=TODAY)
    assert blocked.nodes[-1].status != "completed" and blocked.progress.percent < 100


def test_valid_draft_passes(context):
    check = validate_draft(draft(), context, planning_budget(context, TODAY))
    assert check.fatal == [] and check.warnings == []


def test_bad_citations_and_foundation_lessons_are_fixed_in_code(context):
    bad = draft()
    bad.steps[1].tasks[0].citations[0].quote = "This sentence is not in the source at all."
    bad.steps[0].tasks[0].task_kind = "learn"
    bad.steps[0].hours_max = 6
    check = validate_draft(bad, context, planning_budget(context, TODAY))
    assert any("no valid citation" in issue for issue in check.fatal)
    assert check.draft.steps[1].tasks[0].citations == []
    assert check.draft.steps[0].tasks[0].task_kind == "check"
    assert check.draft.steps[0].hours_max == 2
    assert len(check.warnings) == 3


def test_citation_must_belong_to_the_steps_skill(context):
    bad = draft()
    bad.steps[1].tasks[0].citations[0].chunk_id = 389  # a RAG source cited on the Airflow step
    bad.steps[1].tasks[0].citations[0].quote = "sometimes called retrieval-augmented generation (RAG)"
    check = validate_draft(bad, context, planning_budget(context, TODAY))
    assert check.draft.steps[1].tasks[0].citations == []
    assert any("no valid citation" in issue for issue in check.fatal)


def test_forgotten_main_skill_is_deferred(context):
    check = validate_draft(draft(deferred=[]), context, planning_budget(context, TODAY))
    assert check.fatal == []
    assert {d.skill_id for d in check.draft.deferred} == {RAG, JAVA}


@pytest.mark.parametrize("change, message", [
    (lambda d: setattr(d.steps[1], "skill_id", 999), "not a main skill"),
    (lambda d: setattr(d.steps[1], "skill_id", 91), "not a main skill"),  # Python is a foundation
    (lambda d: setattr(d.steps[0], "depends_on", ["project"]), "cycle"),
    (lambda d: setattr(d.steps[1], "hours_min", 90), "budget"),
    (lambda d: setattr(d.steps[2], "key", "airflow"), "unique"),
])
def test_structural_problems_are_fatal(context, change, message):
    bad = draft()
    change(bad)
    if bad.steps[1].hours_min == 90:
        bad.steps[1].hours_max = 95
    check = validate_draft(bad, context, planning_budget(context, TODAY))
    assert any(message in issue for issue in check.fatal), check.fatal


def test_mock_roadmap_is_valid_and_free(context):
    model = MockRoadmapModel()
    result = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY))
    assert result.cost_usd == 0 and result.warnings == []
    kinds = [node.kind for node in result.view.nodes]
    assert kinds[-1] == "goal" and "skill" in kinds
    assert result.view.summary.estimated_hours.min <= 65
    assert all(c.url for node in result.view.nodes for c in node.citations)


class ScriptedModel:
    """Returns a broken draft first, then a valid one on repair."""

    provider, model_id = "fake", "fake-model"

    def __init__(self, first: RoadmapDraft, second: RoadmapDraft):
        self.drafts = [first, second]
        self.repair_issues: list[str] = []

    def generate(self, compact):
        usage = Usage()
        usage.add(SimpleNamespace(input_tokens=1000, output_tokens=500))
        return ModelTurn(draft=self.drafts[0], usage=usage)

    def repair(self, turn, issues):
        self.repair_issues = issues
        turn.usage.add(SimpleNamespace(input_tokens=1200, output_tokens=500))
        return ModelTurn(draft=self.drafts[1], usage=turn.usage)


def test_one_repair_call_fixes_a_fatal_draft(context):
    broken = draft()
    broken.steps[1].skill_id = 999
    model = ScriptedModel(broken, draft())
    result = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY))
    assert model.repair_issues and result.usage.calls == 2
    assert result.cost_usd == pytest.approx(estimate_cost(result.usage, Pricing(), provider="fake"))


def test_failed_repair_reports_cost(context):
    broken = draft()
    broken.steps[1].skill_id = 999
    model = ScriptedModel(broken, broken)
    with pytest.raises(GenerationFailed) as err:
        generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY))
    assert err.value.code == "ROADMAP_VALIDATION_FAILED" and err.value.cost_usd > 0


def test_progress_counts_tasks_and_skips(context):
    model = MockRoadmapModel()
    view = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY)).view
    first = view.nodes[0]
    done = {item.id for item in first.checklist}
    updated = apply_progress(view, completed_tasks=done, skipped_steps=set())
    assert updated.nodes[0].status == "completed"
    assert updated.progress.completed_steps == 1 and 0 < updated.progress.percent < 100


def test_output_schema_is_strict():
    def objects(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                yield node
            for value in node.values():
                yield from objects(value)
        elif isinstance(node, list):
            for value in node:
                yield from objects(value)

    found = list(objects(output_schema()))
    assert found and all(o["additionalProperties"] is False and set(o["required"]) == set(o["properties"])
                         for o in found)


class FakeStream:
    def __init__(self, message):
        self.message = message

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return self.message


class FakeClient:
    def __init__(self, message):
        self.calls = []
        self.messages = SimpleNamespace(stream=self._stream)
        self._message = message

    def _stream(self, **kwargs):
        self.calls.append(kwargs)
        return FakeStream(self._message)


def _message(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=6000, output_tokens=3000, cache_read_input_tokens=0,
                              cache_creation_input_tokens=0))


def test_claude_call_shape_and_parse(context):
    client = FakeClient(_message(draft().model_dump_json()))
    model = ClaudeRoadmapModel(client, provider="bedrock", model_id="anthropic.claude-opus-5-5", effort="medium")
    turn = model.generate(compact_context(context, planning_budget(context, TODAY)))
    call = client.calls[0]
    assert call["model"] == "anthropic.claude-opus-5-5"
    assert call["thinking"] == {"type": "adaptive"}
    assert call["output_config"]["effort"] == "medium"
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "tool_choice" not in call and "temperature" not in call
    assert turn.draft.title == "Data Engineer roadmap" and turn.usage.output_tokens == 3000
    assert turn.messages[-1]["role"] == "assistant"


def test_gemini_uses_json_schema_field_for_pydantic_contract(monkeypatch):
    from google.genai import types

    monkeypatch.setattr(types, "GenerateContentConfig", lambda **kwargs: kwargs)
    monkeypatch.setattr(types, "ThinkingConfig", lambda **kwargs: kwargs)
    calls = []

    def generate_content(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            text=draft().model_dump_json(),
            usage_metadata=SimpleNamespace(prompt_token_count=10, candidates_token_count=20,
                                           thoughts_token_count=0),
            candidates=[], prompt_feedback=None,
        )

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    model = GeminiRoadmapModel(client, model_id="gemini-3.8-flash")
    turn = model.generate({})

    config = calls[0]["config"]
    assert "response_json_schema" in config
    assert config["response_json_schema"] == RoadmapDraft.model_json_schema()
    assert "response_schema" not in config
    assert turn.draft.title == "Data Engineer roadmap" and turn.usage.calls == 1


def test_claude_refusal_keeps_billed_usage(context):
    client = FakeClient(_message("", stop_reason="refusal"))
    model = ClaudeRoadmapModel(client, provider="anthropic", model_id="claude-opus-5-5")
    with pytest.raises(ModelError) as err:
        model.generate({"x": 1})
    assert err.value.code == "MODEL_REFUSAL" and err.value.usage.input_tokens == 6000


FIGMA_DEPS = {  # the Figma "My Roadmap dashboard" graph, with the goal last
    "python": [], "sql": ["python"], "etl": ["sql"], "build-etl": ["etl"], "docker": ["build-etl"],
    "airflow": ["docker"], "containerize": ["docker"], "build-dag": ["airflow"],
    "deploy": ["containerize", "build-dag"], "polish": ["deploy"], "apply": ["deploy"],
    "goal": ["polish", "apply"],
}


def test_layout_fits_the_canvas_grid():
    keys = list(FIGMA_DEPS)
    positions = layout.place(keys, FIGMA_DEPS)
    assert len(set(positions.values())) == len(keys)  # no two nodes share a cell
    assert all(1 <= column <= layout.COLUMNS for _, column in positions.values())
    assert max(row for row, _ in positions.values()) <= layout.MAX_ROWS
    for key, deps in FIGMA_DEPS.items():
        assert all(positions[d][0] <= positions[key][0] for d in deps)  # never above a prerequisite
    assert [positions[k] for k in ("python", "sql", "etl", "build-etl")] == [(1, 1), (1, 2), (1, 3), (1, 4)]
    assert positions["goal"][0] == max(row for row, _ in positions.values())


def test_chain_flows_across_a_row_then_wraps():
    deps = {"a": [], "b": ["a"], "c": ["b"], "d": ["c"], "e": ["d"], "goal": ["e"]}
    assert layout.place(list(deps), deps) == {
        "a": (1, 1), "b": (1, 2), "c": (1, 3), "d": (1, 4), "e": (2, 2), "goal": (2, 4)}


def test_node_text_and_next_step_follow_progress(context):
    model = MockRoadmapModel()
    view = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY)).view
    keys = [n.key for n in view.nodes]
    assert view.layout.rows == 2 and view.current_node_key == view.next_action.node_key == keys[0]
    assert view.nodes[0].subtitle == "Quick check" and view.nodes[-1].subtitle == "Target: Jan 18, 2027"
    assert view.progress.label == "0 of 9 tasks done"

    started = apply_progress(view, completed_tasks=set(), skipped_steps=set(), started_steps={keys[1]}, today=TODAY)
    assert started.nodes[1].status == "in_progress" and started.current_node_key == keys[1]

    done = {i.id for i in view.nodes[0].checklist}
    moved = apply_progress(view, completed_tasks=done, skipped_steps=set(), today=TODAY)
    assert moved.next_action.node_key == keys[1] and moved.next_action.text.startswith("Next up: ")

    everything = {i.id for n in view.nodes for i in n.checklist}
    finished = apply_progress(view, completed_tasks=everything, skipped_steps=set(), today=TODAY)
    assert finished.next_action.node_key == "goal" and finished.nodes[-1].status == "completed"

    assert apply_progress(view, completed_tasks=set(), skipped_steps=set(), today=TODAY
                          ).summary.time_remaining_label == "3 months remaining"
    assert apply_progress(view, completed_tasks=set(), skipped_steps=set(), today=date(2027, 2, 1)
                          ).summary.time_remaining_label == "Target date has passed"


def test_foundation_check_edges_are_optional(context):
    model = MockRoadmapModel()
    view = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY)).view
    assert {(e.from_, e.optional) for e in view.edges if e.from_ == view.nodes[0].key} == {(view.nodes[0].key, True)}
    assert not any(e.optional for e in view.edges if e.from_ != view.nodes[0].key)


def test_plan_that_does_not_fit_the_canvas_is_fatal(context):
    steps, previous = [], []
    for level in range(7):  # seven levels of two parallel steps, each needing both steps before it
        keys = [f"s{level}a", f"s{level}b"]
        for key in keys:
            steps.append({"key": key, "kind": "project", "skill_id": None, "title": key, "summary": "x",
                          "why": ["x"], "hours_min": 1, "hours_max": 1, "depends_on": list(previous),
                          "tasks": [{"title": "t", "detail": "d", "task_kind": "practice", "citations": []}]})
        previous = keys
    wide = draft(steps=steps, deferred=[], confirmations=[], next_action={"step_key": "s0a", "text": "Go."})
    check = validate_draft(wide, context, planning_budget(context, TODAY))
    assert any("canvas fits 6" in issue for issue in check.fatal), check.fatal
