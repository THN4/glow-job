"""Nova roadmap adapter for Bedrock Runtime's Converse API (not Claude Mantle).

The provider returns the existing RoadmapDraft; context assembly, semantic
validation, persistence and progress stay in the shared generation pipeline.
"""

from __future__ import annotations

import json
from typing import Any

from ai.roadmap.contracts import RoadmapDraft
from ai.roadmap.prompt import SYSTEM_PROMPT, build_repair_message, build_user_message
from ai.roadmap.providers import ModelError, ModelTurn, Usage

DEFAULT_NOVA_MODEL = "amazon.nova-pro-v1:0"
NOVA_V1_MAX_TOKENS = 5000


def create_converse_client(region: str) -> Any:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError

    try:
        return boto3.client("bedrock-runtime", region_name=region, config=Config(
            retries={"total_max_attempts": 3, "mode": "adaptive"},
            connect_timeout=10, read_timeout=120,
        ))
    except BotoCoreError as error:
        raise ModelError("MODEL_UNAVAILABLE", "Bedrock credentials or client configuration are unavailable.") from error


class BedrockConverseRoadmapModel:
    provider = "bedrock_converse"

    def __init__(self, client: Any, *, model_id: str = DEFAULT_NOVA_MODEL, max_tokens: int = NOVA_V1_MAX_TOKENS):
        self._client = client
        self.model_id = model_id
        # Existing ROADMAP_MAX_TOKENS defaults to 24k. Nova v1 permits at most 5k.
        self._max_tokens = min(max_tokens, NOVA_V1_MAX_TOKENS)
        self._system = SYSTEM_PROMPT + (
            "\nReturn only one JSON object, with no markdown or commentary. "
            "Match this JSON schema exactly:\n" + json.dumps(RoadmapDraft.model_json_schema(), ensure_ascii=False)
        )

    def generate(self, compact: dict[str, Any]) -> ModelTurn:
        return self._call([{"role": "user", "content": [{"text": build_user_message(compact)}]}], Usage())

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn:
        messages = [*turn.messages, {"role": "user", "content": [{"text": build_repair_message(issues)}]}]
        return self._call(messages, turn.usage)

    def _call(self, messages: list[dict[str, Any]], usage: Usage) -> ModelTurn:
        from botocore.exceptions import BotoCoreError, ClientError, ConnectionError, ReadTimeoutError

        try:
            response = self._client.converse(
                modelId=self.model_id,
                system=[{"text": self._system}],
                messages=messages,
                inferenceConfig={"maxTokens": self._max_tokens, "temperature": 0},
            )
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "Unknown")
            retryable = code in {"ThrottlingException", "ModelNotReadyException", "ModelTimeoutException"} \
                or error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0) >= 500
            # Do not expose request contents, credentials or provider response bodies.
            raise ModelError("MODEL_UNAVAILABLE", f"Bedrock request failed ({code}). Check model access and region/profile configuration.",
                             retryable=retryable, usage=usage) from error
        except (ConnectionError, ReadTimeoutError) as error:
            raise ModelError("MODEL_UNAVAILABLE", "Bedrock could not be reached or timed out.",
                             retryable=True, usage=usage) from error
        except BotoCoreError as error:
            raise ModelError("MODEL_UNAVAILABLE", "Bedrock credentials or request configuration are unavailable.",
                             usage=usage) from error

        tokens = response.get("usage", {})
        usage.calls += 1
        usage.input_tokens += tokens.get("inputTokens", 0)
        usage.output_tokens += tokens.get("outputTokens", 0)
        usage.cache_read_input_tokens += tokens.get("cacheReadInputTokens", 0)
        usage.cache_creation_input_tokens += tokens.get("cacheWriteInputTokens", 0)
        stop = response.get("stopReason")
        if stop in {"content_filtered", "guardrail_intervened"}:
            raise ModelError("MODEL_REFUSAL", "Bedrock declined to create this roadmap.", usage=usage)
        if stop == "max_tokens":
            raise ModelError("MODEL_OUTPUT_TRUNCATED", "Nova reached its output token limit before completing the roadmap.", usage=usage)
        if stop != "end_turn":
            raise ModelError("MODEL_INVALID_OUTPUT", "Bedrock did not return a completed roadmap.", usage=usage)
        message = response.get("output", {}).get("message", {})
        text = "".join(block.get("text", "") for block in message.get("content", []))
        try:
            draft = RoadmapDraft.model_validate_json(text)
        except ValueError as error:
            raise ModelError("MODEL_INVALID_OUTPUT", "Nova returned an invalid roadmap JSON object.", usage=usage) from error
        return ModelTurn(draft=draft, usage=usage, messages=[*messages, message])
