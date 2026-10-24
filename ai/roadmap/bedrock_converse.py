"""Amazon Nova roadmap adapter for Bedrock Runtime's Converse API.

The provider returns the existing RoadmapDraft; context assembly, semantic
validation, persistence and progress stay in the shared generation pipeline.
"""

from __future__ import annotations

import errno
import json
import logging
from typing import Any

from ai.roadmap.contracts import RoadmapDraft
from ai.roadmap.prompt import SYSTEM_PROMPT, build_repair_message, build_user_message
from ai.roadmap.providers import ModelError, ModelTurn, Usage

DEFAULT_NOVA_MODEL = "us.amazon.nova-2-lite-v1:0"
NOVA_MAX_OUTPUT_TOKENS = 5000
log = logging.getLogger("roadmap")


class _InvalidRoadmapOutput(ModelError):
    """Keep the rejected assistant turn for repair without logging its contents."""

    def __init__(self, *, usage: Usage, issues: list[str], messages: list[dict[str, Any]]):
        super().__init__("MODEL_INVALID_OUTPUT", "Nova returned an invalid roadmap JSON object.",
                         usage=usage, issues=issues)
        self.messages = messages


def _repair_messages(messages: list[dict[str, Any]], issues: list[str]) -> list[dict[str, Any]]:
    feedback = (
        build_repair_message(issues)
        + "\nCall submit_roadmap with the complete corrected object, not a patch or an error report."
        + " Include every required top-level field and a title for every task."
    )
    content: list[dict[str, Any]] = [{"text": feedback}]
    if messages and messages[-1].get("role") == "assistant":
        for block in messages[-1].get("content", []):
            tool = block.get("toolUse", {})
            if tool.get("toolUseId"):
                # Converse requires a matching result before the next model turn.
                content.append({"toolResult": {
                    "toolUseId": tool["toolUseId"],
                    "content": [{"text": feedback}],
                    "status": "error",
                }})
    return [*messages, {"role": "user", "content": content}]


def credential_cache_error(usage: Usage | None = None) -> ModelError:
    return ModelError("MODEL_UNAVAILABLE", "AWS could not update its credentials cache. Allow writes to the login cache directory and retry.",
                      usage=usage)


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
    except OSError as error:
        if error.errno in {errno.EROFS, errno.EACCES, errno.EPERM}:
            raise credential_cache_error() from error
        raise


class BedrockConverseRoadmapModel:
    provider = "bedrock_converse"

    def __init__(self, client: Any, *, model_id: str = DEFAULT_NOVA_MODEL, max_tokens: int = NOVA_MAX_OUTPUT_TOKENS):
        self._client = client
        self.model_id = model_id
        # Nova's previous Converse adapter capped generation at 5,000 tokens.
        self._max_tokens = min(max_tokens, NOVA_MAX_OUTPUT_TOKENS)
        # Keep the Gemini system prompt unchanged. The required JSON structure is
        # supplied through tool configuration, not appended to the prompt.
        self._system = SYSTEM_PROMPT
        self._tool_schema = RoadmapDraft.model_json_schema()

    def generate(self, compact: dict[str, Any]) -> ModelTurn:
        return self._call_with_retry([{"role": "user", "content": [{"text": build_user_message(compact)}]}], Usage())

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn:
        messages = _repair_messages(turn.messages, issues)
        return self._call_with_retry(messages, turn.usage)

    def _call_with_retry(self, messages: list[dict[str, Any]], usage: Usage) -> ModelTurn:
        try:
            return self._call(messages, usage)
        except ModelError as error:
            if error.code != "MODEL_INVALID_OUTPUT":
                raise
            # Give Nova actionable schema feedback instead of repeating the same
            # prompt when its tool input fails Pydantic validation.
            retry_messages = messages
            if isinstance(error, _InvalidRoadmapOutput):
                retry_messages = _repair_messages(error.messages, error.issues)
            elif error.issues and messages and messages[-1].get("role") == "user":
                retry_messages = [*messages[:-1], {
                    **messages[-1],
                    "content": [
                        *messages[-1].get("content", []),
                        {"text": build_repair_message(error.issues)},
                    ],
                }]
            return self._call(retry_messages, usage)

    def _call(self, messages: list[dict[str, Any]], usage: Usage) -> ModelTurn:
        from botocore.exceptions import BotoCoreError, ClientError, ConnectionError, ReadTimeoutError

        try:
            response = self._client.converse(
                modelId=self.model_id,
                system=[{"text": self._system}],
                messages=messages,
                inferenceConfig={"maxTokens": self._max_tokens, "temperature": 0},
                toolConfig={
                    "tools": [{"toolSpec": {
                        "name": "submit_roadmap",
                        "description": "Return the complete roadmap matching the required schema. Every task must include title, detail and task_kind. Do not return a patch or a wrapper object.",
                        "inputSchema": {"json": self._tool_schema},
                    }}],
                    "toolChoice": {"tool": {"name": "submit_roadmap"}},
                },
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
        except OSError as error:
            if error.errno in {errno.EROFS, errno.EACCES, errno.EPERM}:
                raise credential_cache_error(usage) from error
            raise

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
        message = response.get("output", {}).get("message", {})
        content = message.get("content", [])
        tool_uses = [block["toolUse"] for block in content if "toolUse" in block]
        if stop == "tool_use" and len(tool_uses) == 1 and tool_uses[0].get("name") == "submit_roadmap" \
                and isinstance(tool_uses[0].get("input"), dict):
            text = json.dumps(tool_uses[0]["input"], ensure_ascii=False)
        elif stop == "end_turn" and not tool_uses:
            # Nova sometimes returns the requested JSON as text despite a
            # forced tool choice. It must still pass the exact draft schema.
            text = "".join(block.get("text", "") for block in content)
        else:
            log.warning("roadmap model output shape invalid stop=%s blocks=%s", stop,
                        [list(block) for block in content])
            raise ModelError("MODEL_INVALID_OUTPUT", "Bedrock did not return the required roadmap structure.", usage=usage)
        try:
            draft = RoadmapDraft.model_validate_json(text)
        except ValueError as error:
            issues = []
            if hasattr(error, "errors"):
                for item in error.errors(include_input=False):
                    location = ".".join(str(part) for part in item.get("loc", ())) or "root"
                    issues.append(f"{location}: {item.get('msg', 'invalid value')} ({item.get('type', 'invalid')})")
            log.warning("roadmap model schema invalid stop=%s blocks=%s error_type=%s issues=%s", stop,
                        [list(block) for block in content], type(error).__name__, issues)
            raise _InvalidRoadmapOutput(usage=usage, issues=issues,
                                        messages=[*messages, message]) from error
        return ModelTurn(draft=draft, usage=usage, messages=[*messages, message])
