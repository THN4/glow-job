"""Nova adapter and API integration, with no AWS credentials, network or real billing."""

import copy
import json
import os
from datetime import date
from pathlib import Path

import pytest
from botocore.exceptions import ClientError, NoCredentialsError, ReadTimeoutError

from ai.roadmap.bedrock_converse import BedrockConverseRoadmapModel
from ai.roadmap.compact import compact_context, planning_budget
from ai.roadmap.cost import pricing_for_model
from ai.roadmap.generate import generate_roadmap, prepare
from ai.roadmap.providers import MockRoadmapModel, ModelError, create_model
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


def response(payload, *, stop="end_turn", input_tokens=1000, output_tokens=500):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return {"output": {"message": {"role": "assistant", "content": [{"text": text}]}},
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


def test_converse_uses_existing_context_schema_and_caps_nova_tokens(context, payload):
    client = ConverseClient(response(payload))
    model = BedrockConverseRoadmapModel(client, max_tokens=24000)
    compact = compact_context(context, planning_budget(context, TODAY))
    turn = model.generate(compact)
    call = client.calls[0]
    assert call["modelId"] == "amazon.nova-pro-v1:0"
    assert call["inferenceConfig"] == {"maxTokens": 5000, "temperature": 0}
    assert "<planning_context>" in call["messages"][0]["content"][0]["text"]
    assert '"$defs"' in call["system"][0]["text"]
    assert not {"thinking", "output_config", "toolConfig"} & call.keys()
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
    assert client.calls[1]["inferenceConfig"]["maxTokens"] == 4000
    assert repaired.usage.calls == 2 and repaired.usage.input_tokens == 2000


@pytest.mark.parametrize("stop,code", [("max_tokens", "MODEL_OUTPUT_TRUNCATED"),
    ("content_filtered", "MODEL_REFUSAL"), ("guardrail_intervened", "MODEL_REFUSAL"),
    ("malformed_model_output", "MODEL_INVALID_OUTPUT"), ("tool_use", "MODEL_INVALID_OUTPUT")])
def test_incomplete_or_refused_responses_fail_with_usage(payload, stop, code):
    model = BedrockConverseRoadmapModel(ConverseClient(response(payload, stop=stop)))
    with pytest.raises(ModelError) as error:
        model.generate({})
    assert error.value.code == code and error.value.usage.output_tokens == 500


@pytest.mark.parametrize("text", ["", "not JSON", "```json\n{}\n```", '{"title":"only title"}'])
def test_invalid_json_never_becomes_a_roadmap(text):
    model = BedrockConverseRoadmapModel(ConverseClient(response(text)))
    with pytest.raises(ModelError) as error:
        model.generate({})
    assert error.value.code == "MODEL_INVALID_OUTPUT" and error.value.usage.calls == 1


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


def test_config_uses_requested_names_and_explicit_overrides(monkeypatch):
    for key in list(os.environ):
        if key.startswith(("ROADMAP_", "BEDROCK_", "AWS_")):
            monkeypatch.delenv(key)
    settings = RoadmapSettings(_env_file=None, ROADMAP_PROVIDER="bedrock_converse",
                              AWS_DEFAULT_REGION="us-east-1", BEDROCK_ROADMAP_MODEL="us.amazon.nova-pro-v1:0",
                              ROADMAP_PRICE_INPUT_PER_MTOK="", ROADMAP_PRICE_OUTPUT_PER_MTOK="")
    assert settings.model_id == "us.amazon.nova-pro-v1:0" and settings.aws_region == "us-east-1"
    explicit = settings.model_copy(update={"ROADMAP_MODEL_ID": "explicit-model", "ROADMAP_AWS_REGION": "explicit-region"})
    assert explicit.model_id == "explicit-model" and explicit.aws_region == "explicit-region"
    gemini = RoadmapSettings(_env_file=None, ROADMAP_PROVIDER="gemini")
    assert gemini.model_id is None  # Nova config must not replace the Gemini default.


def test_factory_preserves_profile_id_and_uses_runtime_client(monkeypatch):
    calls = []
    client = ConverseClient()
    monkeypatch.setattr("ai.roadmap.bedrock_converse.create_converse_client", lambda region: calls.append(region) or client)
    model = create_model("bedrock_converse", model_id="us.amazon.nova-pro-v1:0", aws_region="us-east-1")
    assert model.model_id == "us.amazon.nova-pro-v1:0" and model._client is client and calls == ["us-east-1"]
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
    assert result.cost_usd == pytest.approx(0.0048)
    assert result.view.generation.provider == "bedrock_converse"


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
    assert repo.runs[0]["cost_usd"] == pytest.approx(0.0024)


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
