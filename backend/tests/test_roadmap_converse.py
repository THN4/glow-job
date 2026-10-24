"""Nova Bedrock Converse adapter and API integration, without live AWS calls."""

import copy
import errno
import json
import os
from datetime import date
from pathlib import Path

import pytest
from botocore.exceptions import ClientError, NoCredentialsError, ReadTimeoutError

from ai.roadmap.bedrock_converse import BedrockConverseRoadmapModel
from ai.roadmap.compact import compact_context, planning_budget
from ai.roadmap.contracts import DraftSkillDetail, DraftStep, DraftTask, RoadmapDraft
from ai.roadmap.cost import pricing_for_model
from ai.roadmap.generate import generate_roadmap, prepare
from ai.roadmap.prompt import SYSTEM_PROMPT
from ai.roadmap.providers import MockRoadmapModel, ModelError, create_model
from ai.roadmap.validate import validate_draft
from app.features.roadmap.config import RoadmapSettings
from rag.context.agent_models import AgentContext

FIXTURE = Path(__file__).resolve().parents[2] / "ai/roadmap/fixtures/agent-context-demo-student.json"
TODAY = date(2026, 10, 19)


@pytest.fixture
def context():
    return AgentContext.model_validate_json(FIXTURE.read_bytes())


@pytest.fixture
def payload(context):
    compact = compact_context(context, planning_budget(context, TODAY))
    return MockRoadmapModel().generate(compact).draft.model_dump()


def response(payload, *, stop="tool_use", input_tokens=1000, output_tokens=500):
    return {"output": {"message": {"role": "assistant", "content": [{"toolUse": {
                "name": "submit_roadmap", "toolUseId": "roadmap", "input": payload,
            }}]}},
            "stopReason": stop, "usage": {"inputTokens": input_tokens, "outputTokens": output_tokens}}


class ConverseClient:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def converse(self, **kwargs):
        self.calls.append(copy.deepcopy(kwargs))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return copy.deepcopy(result)


def test_converse_uses_existing_context_schema_and_configured_output_tokens(context, payload):
    client = ConverseClient(response(payload))
    model = BedrockConverseRoadmapModel(client, max_tokens=24000)
    compact = compact_context(context, planning_budget(context, TODAY))
    turn = model.generate(compact)
    call = client.calls[0]
    assert call["modelId"] == "us.amazon.nova-2-lite-v1:0"
    assert call["inferenceConfig"] == {"maxTokens": 5000, "temperature": 0}
    assert "<planning_context>" in call["messages"][0]["content"][0]["text"]
    assert call["system"][0]["text"] == SYSTEM_PROMPT
    assert context.context_id not in call["system"][0]["text"]
    assert call["toolConfig"]["toolChoice"] == {"tool": {"name": "submit_roadmap"}}
    schema = call["toolConfig"]["tools"][0]["toolSpec"]["inputSchema"]["json"]
    assert schema == RoadmapDraft.model_json_schema()
    assert "outputConfig" not in call
    assert turn.draft.model_dump() == payload
    assert turn.usage.as_dict() == {"calls": 1, "input_tokens": 1000, "output_tokens": 500,
                                  "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}


def test_repair_keeps_converse_history_and_accumulates_usage(payload):
    client = ConverseClient(response(payload), response(payload))
    model = BedrockConverseRoadmapModel(client, max_tokens=4000)
    first = model.generate({})
    repaired = model.repair(first, ["Citation must match the reviewed source."])
    assert [m["role"] for m in client.calls[1]["messages"]] == ["user", "assistant", "user"]
    assert "Citation must match" in client.calls[1]["messages"][-1]["content"][0]["text"]
    tool_result = client.calls[1]["messages"][-1]["content"][1]["toolResult"]
    assert tool_result["toolUseId"] == "roadmap" and tool_result["status"] == "error"
    assert client.calls[1]["inferenceConfig"]["maxTokens"] == 4000
    assert repaired.usage.calls == 2 and repaired.usage.input_tokens == 2000


@pytest.mark.parametrize("stop,code", [("max_tokens", "MODEL_OUTPUT_TRUNCATED"),
    ("content_filtered", "MODEL_REFUSAL"), ("guardrail_intervened", "MODEL_REFUSAL"),
    ("malformed_model_output", "MODEL_INVALID_OUTPUT"), ("end_turn", "MODEL_INVALID_OUTPUT")])
def test_incomplete_or_refused_responses_fail_with_usage(payload, stop, code):
    client = ConverseClient(response(payload, stop=stop), response(payload, stop=stop))
    model = BedrockConverseRoadmapModel(client)
    with pytest.raises(ModelError) as error:
        model.generate({})
    assert error.value.code == code
    assert error.value.usage.output_tokens == (1000 if code == "MODEL_INVALID_OUTPUT" else 500)
    assert len(client.calls) == (2 if code == "MODEL_INVALID_OUTPUT" else 1)


@pytest.mark.parametrize("value", [None, "not JSON", [], {"title": "only title"}])
def test_invalid_tool_output_never_becomes_a_roadmap(value):
    model = BedrockConverseRoadmapModel(ConverseClient(response(value), response(value)))
    with pytest.raises(ModelError) as error:
        model.generate({})
    assert error.value.code == "MODEL_INVALID_OUTPUT" and error.value.usage.calls == 2


def test_non_skill_steps_may_omit_skill_id():
    step = DraftStep.model_validate({
        "key": "portfolio-project",
        "kind": "project",
        "title": "Build a small portfolio project",
        "summary": "Apply the planned skills.",
        "why": ["Practice the workflow end to end."],
        "hours_min": 2,
        "hours_max": 4,
        "depends_on": [],
        "tasks": [],
    })

    assert step.skill_id is None
    assert "skill_id" not in DraftStep.model_json_schema()["required"]


def test_task_and_detail_citations_can_be_omitted():
    task = DraftTask.model_validate({
        "title": "Practice the workflow",
        "detail": "Build a small example.",
        "task_kind": "practice",
    })
    detail = DraftSkillDetail.model_validate({
        "title": "Core concepts",
        "detail": "Review the central concepts.",
    })

    assert task.citations == []
    assert detail.citations == []
    assert "citations" not in DraftTask.model_json_schema()["required"]
    assert "citations" not in DraftSkillDetail.model_json_schema()["required"]


def test_learn_task_without_citations_still_fails_validation(context, payload):
    incomplete = copy.deepcopy(payload)
    task = next(task for step in incomplete["steps"] for task in step["tasks"]
                if task["task_kind"] == "learn")
    task.pop("citations")

    check = validate_draft(RoadmapDraft.model_validate(incomplete), context,
                           planning_budget(context, TODAY))

    assert any("no valid citation" in issue for issue in check.fatal)


def test_roadmap_repair_adds_tasks_omitted_by_nova(context, payload):
    incomplete = copy.deepcopy(payload)
    step = next(step for step in incomplete["steps"] if step["kind"] == "skill")
    step.pop("tasks")
    client = ConverseClient(response(incomplete), response(payload))
    model = BedrockConverseRoadmapModel(client)

    prepared = prepare(context, model, today=TODAY)
    result = generate_roadmap(context, model, prepared=prepared)

    assert result.view is not None
    assert len(client.calls) == 2
    repair_text = client.calls[1]["messages"][-1]["content"][0]["text"]
    assert "has no tasks" in repair_text


def test_invalid_first_output_is_retried_with_schema_feedback(payload):
    client = ConverseClient(response({"title": "incomplete"}), response(payload))
    turn = BedrockConverseRoadmapModel(client).generate({"goal": "example"})
    assert turn.draft.model_dump() == payload
    assert turn.usage.calls == 2
    first = client.calls[0]["messages"]
    retry = client.calls[1]["messages"]
    assert first[0]["content"][0]["text"] in retry[0]["content"][0]["text"]
    assert [message["role"] for message in retry] == ["user", "assistant", "user"]
    assert retry[1]["content"][0]["toolUse"]["input"] == {"title": "incomplete"}
    assert "overview" in retry[-1]["content"][0]["text"]
    assert "Field required" in retry[-1]["content"][0]["text"]
    assert retry[-1]["content"][1]["toolResult"]["toolUseId"] == "roadmap"


def test_missing_task_titles_repair_preserves_the_rejected_draft(payload):
    incomplete = copy.deepcopy(payload)
    task = next(task for step in incomplete["steps"] for task in step["tasks"])
    task.pop("title")
    client = ConverseClient(response(incomplete), response(payload))

    turn = BedrockConverseRoadmapModel(client).generate({"goal": "example"})

    retry = client.calls[1]["messages"]
    assert retry[1]["content"][0]["toolUse"]["input"] == incomplete
    assert ".title: Field required" in retry[-1]["content"][0]["text"]
    assert "complete corrected object" in retry[-1]["content"][0]["text"]
    assert turn.draft.model_dump() == payload
    assert turn.usage.calls == 2 and turn.usage.output_tokens == 1000


def test_invalid_text_draft_repair_does_not_send_a_tool_result(payload):
    invalid = {"output": {"message": {"role": "assistant", "content": [
        {"text": json.dumps({"overview": "Only an overview"})},
    ]}}, "stopReason": "end_turn", "usage": {"inputTokens": 20, "outputTokens": 10}}
    client = ConverseClient(invalid, response(payload))

    turn = BedrockConverseRoadmapModel(client).generate({})

    retry = client.calls[1]["messages"]
    assert retry[1] == invalid["output"]["message"]
    assert all("toolResult" not in block for block in retry[-1]["content"])
    assert turn.draft.model_dump() == payload


def test_valid_json_text_is_accepted_when_nova_ends_without_tool(payload):
    plain = {"output": {"message": {"role": "assistant", "content": [
        {"text": json.dumps(payload)},
    ]}}, "stopReason": "end_turn", "usage": {"inputTokens": 1000, "outputTokens": 500}}
    client = ConverseClient(plain)
    turn = BedrockConverseRoadmapModel(client).generate({})
    assert turn.draft.model_dump() == payload
    assert turn.usage.calls == 1


@pytest.mark.parametrize("code,status,retryable", [("AccessDeniedException", 403, False),
    ("ValidationException", 400, False), ("ThrottlingException", 429, True),
    ("InternalServerException", 500, True)])
def test_aws_errors_are_classified_without_exposing_response_body(code, status, retryable):
    failure = ClientError({"Error": {"Code": code, "Message": "PRIVATE PROVIDER BODY"},
                           "ResponseMetadata": {"HTTPStatusCode": status}}, "Converse")
    model = BedrockConverseRoadmapModel(ConverseClient(failure))
    with pytest.raises(ModelError) as error:
        model.generate({})
    assert error.value.code == "MODEL_UNAVAILABLE" and error.value.retryable is retryable
    assert "PRIVATE" not in error.value.message


@pytest.mark.parametrize("failure,retryable", [(NoCredentialsError(), False),
    (ReadTimeoutError(endpoint_url="https://example.invalid"), True)])
def test_credentials_and_timeout_errors(failure, retryable):
    with pytest.raises(ModelError) as error:
        BedrockConverseRoadmapModel(ConverseClient(failure)).generate({})
    assert error.value.retryable is retryable


@pytest.mark.parametrize("error_number", [errno.EROFS, errno.EACCES, errno.EPERM])
def test_credentials_cache_write_failure_becomes_actionable_model_error(error_number):
    failure = OSError(error_number, "PRIVATE cache path")
    with pytest.raises(ModelError) as error:
        BedrockConverseRoadmapModel(ConverseClient(failure)).generate({})
    assert error.value.code == "MODEL_UNAVAILABLE"
    assert "login cache" in error.value.message and "PRIVATE" not in error.value.message
    assert error.value.usage.calls == 0


def test_client_creation_handles_readonly_credentials_cache(monkeypatch):
    import boto3
    from ai.roadmap.bedrock_converse import create_converse_client

    def fail(*args, **kwargs):
        raise OSError(errno.EROFS, "PRIVATE cache path")

    monkeypatch.setattr(boto3, "client", fail)
    with pytest.raises(ModelError, match="login cache"):
        create_converse_client("us-east-1")


def test_unrelated_os_errors_are_not_mislabelled_as_credentials_errors():
    with pytest.raises(OSError):
        BedrockConverseRoadmapModel(ConverseClient(OSError(errno.ENOSPC, "disk full"))).generate({})


def test_config_uses_requested_names_and_explicit_overrides(monkeypatch):
    for key in list(os.environ):
        if key.startswith(("ROADMAP_", "BEDROCK_", "AWS_")):
            monkeypatch.delenv(key)
    settings = RoadmapSettings(_env_file=None, ROADMAP_PROVIDER="bedrock_converse",
                              AWS_DEFAULT_REGION="us-east-1", BEDROCK_ROADMAP_MODEL="amazon.nova-pro-v1:0",
                              ROADMAP_PRICE_INPUT_PER_MTOK="", ROADMAP_PRICE_OUTPUT_PER_MTOK="")
    assert settings.model_id == "amazon.nova-pro-v1:0" and settings.aws_region == "us-east-1"
    explicit = settings.model_copy(update={"ROADMAP_MODEL_ID": "explicit-model", "ROADMAP_AWS_REGION": "explicit-region"})
    assert explicit.model_id == "explicit-model" and explicit.aws_region == "explicit-region"
    gemini = RoadmapSettings(_env_file=None, ROADMAP_PROVIDER="gemini")
    assert gemini.model_id is None  # Nova config must not replace the Gemini default.


def test_config_defaults_bedrock_roadmap_to_nova_lite(monkeypatch):
    for key in list(os.environ):
        if key.startswith(("ROADMAP_", "BEDROCK_", "AWS_")):
            monkeypatch.delenv(key)
    settings = RoadmapSettings(_env_file=None, ROADMAP_PROVIDER="bedrock_converse")
    assert settings.model_id == "us.amazon.nova-2-lite-v1:0"


def test_factory_preserves_profile_id_and_uses_runtime_client(monkeypatch):
    calls = []
    client = ConverseClient()
    monkeypatch.setattr("ai.roadmap.bedrock_converse.create_converse_client", lambda region: calls.append(region) or client)
    model = create_model("bedrock_converse", model_id="amazon.nova-pro-v1:0", aws_region="us-east-1")
    assert model.model_id == "amazon.nova-pro-v1:0" and model._client is client and calls == ["us-east-1"]
    with pytest.raises(ValueError, match="region"):
        create_model("bedrock_converse")


def test_client_has_bounded_retries_and_timeouts(monkeypatch):
    import boto3
    from ai.roadmap.bedrock_converse import create_converse_client

    calls = []
    monkeypatch.setattr(boto3, "client", lambda *args, **kwargs: calls.append((args, kwargs)) or "client")
    assert create_converse_client("us-east-1") == "client"
    args, kwargs = calls[0]
    assert args == ("bedrock-runtime",) and kwargs["region_name"] == "us-east-1"
    config = kwargs["config"]
    assert config.connect_timeout == 10 and config.read_timeout == 120
    assert config.retries == {"total_max_attempts": 3, "mode": "adaptive"}


def test_smoke_test_cannot_bill_without_explicit_flag(monkeypatch):
    import importlib.util
    import sys

    script = FIXTURE.parents[3] / "scripts/roadmap/nova_smoke_test.py"
    spec = importlib.util.spec_from_file_location("nova_smoke_test", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(sys, "argv", ["nova_smoke_test"])
    with pytest.raises(SystemExit) as error:
        module.main()
    assert error.value.code == 2


def test_nova_pricing_and_explicit_overrides():
    for model in ["amazon.nova-pro-v1:0", "us.amazon.nova-pro-v1:0"]:
        prices = pricing_for_model("bedrock_converse", model)
        assert (prices.input_per_mtok, prices.output_per_mtok) == (0.8, 3.2)
    lite = pricing_for_model("bedrock_converse", "us.amazon.nova-2-lite-v1:0")
    assert (lite.input_per_mtok, lite.output_per_mtok) == (0.33, 2.75)
    assert pricing_for_model("gemini", None).output_per_mtok == 3.75
    assert pricing_for_model("bedrock_converse", "other", input_price=0, output_price=1).input_per_mtok == 0
    with pytest.raises(ValueError, match="Set both"):
        pricing_for_model("bedrock_converse", "other")


def test_semantic_validator_repairs_bad_citations_without_changing_pipeline(context, payload):
    invalid = copy.deepcopy(payload)
    citation = next(c for step in invalid["steps"] for task in step["tasks"] for c in task["citations"])
    citation["chunk_id"] = 999999
    client = ConverseClient(response(invalid), response(payload))
    model = BedrockConverseRoadmapModel(client)
    result = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY),
                              pricing=pricing_for_model(model.provider, model.model_id))
    assert result.usage.calls == 2
    assert result.cost_usd == pytest.approx(0.00341)
    assert result.view.generation.provider == "bedrock_converse"


def baseline_context(context):
    main = context.roadmap_candidates[0]
    baseline = main.model_copy(update={
        "learning_recommendation": "reference_only",
        "gap": main.gap.model_copy(update={"status": "not_assessed", "current_level": "unknown"}),
    })
    confirmed = context.user_context.confirmed_skills[0].model_copy(update={
        "skill_id": main.skill_id, "skill_name": main.skill_name, "proficiency_level": "unknown",
    })
    def updated_counts(summary):
        counts = summary.model_dump()
        counts[main.gap.status] -= 1
        counts["not_assessed"] += 1
        return summary.model_validate(counts)

    updated = context.model_copy(update={
        "roadmap_candidates": (baseline, *context.roadmap_candidates[1:]),
        "market_skill_assessments": tuple(item.model_copy(update={"gap": baseline.gap})
                                          if item.market.skill_id == main.skill_id else item
                                          for item in context.market_skill_assessments),
        "selected_skill_gap_summary": updated_counts(context.selected_skill_gap_summary),
        "skill_gap_summary": updated_counts(context.skill_gap_summary),
        "user_context": context.user_context.model_copy(update={
            "confirmed_skills": (*context.user_context.confirmed_skills, confirmed),
        }),
    })
    return AgentContext.model_validate(updated.model_dump())


def test_completed_skill_details_use_exact_reviewed_evidence_instead_of_model_quotes(context):
    context = baseline_context(context)
    compact = compact_context(context, planning_budget(context, TODAY))
    draft = MockRoadmapModel().generate(compact).draft.model_dump()
    baseline = next(step for step in draft["steps"] if step["kind"] == "completed_skill")
    baseline["details"] = [{"title": "Invented topic", "detail": "UNSUPPORTED CLAIM",
                             "citations": [{"chunk_id": 999999, "quote": "This invented quote does not exist in any source."}]}]
    model = BedrockConverseRoadmapModel(ConverseClient(response(draft)))
    result = generate_roadmap(context, model, prepared=prepare(context, model, today=TODAY))
    result_step = next(step for step in result.draft.steps if step.kind == "completed_skill")
    claims = context.roadmap_candidates[0].claims
    assert result.usage.calls == 1
    assert result_step.details
    assert all(detail.detail in {claim.text for claim in claims} for detail in result_step.details)
    assert all((cite.chunk_id, cite.quote) in {(c.chunk_id, c.quote) for claim in claims for c in claim.citations}
               for detail in result_step.details for cite in detail.citations)
    assert "UNSUPPORTED CLAIM" not in result.view.model_dump_json()


def test_compaction_preserves_reviewed_quotes_for_main_and_completed_skills(context):
    context = baseline_context(context)
    compact = compact_context(context, planning_budget(context, TODAY))
    for group in ("main_skills", "completed_skills"):
        assert compact[group]
        for skill in compact[group]:
            candidate = next(item for item in context.roadmap_candidates if item.skill_id == skill["skill_id"])
            for copied, original in zip(skill["claims"], candidate.claims, strict=True):
                assert copied["citations"] == [{"chunk_id": cite.chunk_id, "quote": cite.quote}
                                               for cite in original.citations]


def test_baseline_without_verified_claims_keeps_no_unreviewed_details(context):
    from ai.roadmap.validate import validate_draft

    context = baseline_context(context)
    compact = compact_context(context, planning_budget(context, TODAY))
    draft = MockRoadmapModel().generate(compact).draft
    candidate = context.roadmap_candidates[0].model_copy(update={"claims": ()})
    context = context.model_copy(update={"roadmap_candidates": (candidate, *context.roadmap_candidates[1:])})
    result = validate_draft(draft, context, planning_budget(context, TODAY))
    assert result.fatal == []
    assert not next(step for step in result.draft.steps if step.kind == "completed_skill").details
    assert any("details were unavailable" in warning for warning in result.warnings)


async def test_converse_api_job_saves_validated_roadmap_and_cost(payload):
    from tests.test_roadmap_api import GOAL_BODY, PROFILE, generate, make

    model = BedrockConverseRoadmapModel(ConverseClient(response(payload)))
    client, svc, repo = make(None, model=model, ROADMAP_PROVIDER="bedrock_converse")
    async with client:
        assert (await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)).status_code == 200
        job = await generate(client, svc)
        assert job["status"] == "succeeded", job
        view = (await client.get(f"/api/profiles/{PROFILE}/roadmaps/current")).json()["roadmap"]
    assert view["generation"]["provider"] == "bedrock_converse"
    assert view["nodes"] and view["edges"]
    assert repo.runs[0]["status"] == "succeeded"
    assert repo.runs[0]["usage"]["output_tokens"] == 500
    assert repo.runs[0]["cost_usd"] == pytest.approx(0.001705)


async def test_invalid_nova_output_does_not_save_partial_roadmap():
    from tests.test_roadmap_api import GOAL_BODY, PROFILE, generate, make

    model = BedrockConverseRoadmapModel(ConverseClient(response("partial", stop="max_tokens")))
    client, svc, repo = make(None, model=model, ROADMAP_PROVIDER="bedrock_converse")
    async with client:
        await client.put(f"/api/profiles/{PROFILE}/goal", json=GOAL_BODY)
        job = await generate(client, svc)
    assert job["status"] == "failed"
    assert repo.roadmaps == {} and repo.runs[0]["status"] == "failed"
    assert repo.runs[0]["usage"]["output_tokens"] == 500
