"""Model providers for roadmap generation.

- ``mock``: deterministic, rule-based roadmap from the context. Costs nothing; default
  for local development, tests and frontend work.
- ``anthropic``: Claude through the Anthropic API (ANTHROPIC_API_KEY or `ant auth login`).
- ``bedrock``: Claude through Amazon Bedrock (AWS credential chain; region required).

Both Claude providers use one streamed Messages call with a JSON-schema output format,
adaptive thinking and an explicit effort level. The SDK is imported lazily so the mock
path runs without it.
"""

from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass, field
from typing import Any, Protocol

from ai.roadmap.contracts import RoadmapDraft
from ai.roadmap.prompt import SYSTEM_PROMPT, build_repair_message, build_user_message

DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_BEDROCK_MODEL = "anthropic.claude-opus-5-5"


class ModelError(Exception):
    """A provider failure with a stable code the API can map to a response."""

    def __init__(self, code: str, message: str, *, retryable: bool = False, usage: "Usage | None" = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.usage = usage  # tokens already billed before the failure, if any


@dataclass
class Usage:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0

    def add(self, usage: Any) -> None:
        self.calls += 1
        self.input_tokens += getattr(usage, "input_tokens", 0) or 0
        self.output_tokens += getattr(usage, "output_tokens", 0) or 0
        self.cache_read_input_tokens += getattr(usage, "cache_read_input_tokens", 0) or 0
        self.cache_creation_input_tokens += getattr(usage, "cache_creation_input_tokens", 0) or 0

    def as_dict(self) -> dict[str, int]:
        return dict(self.__dict__)


@dataclass
class ModelTurn:
    draft: RoadmapDraft
    usage: Usage
    messages: list[dict[str, Any]] = field(default_factory=list)


class RoadmapModel(Protocol):
    provider: str
    model_id: str

    def generate(self, compact: dict[str, Any]) -> ModelTurn: ...

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn: ...


# --------------------------------------------------------------------------- Claude


def output_schema() -> dict[str, Any]:
    """RoadmapDraft as a JSON schema accepted by structured outputs.

    Pydantic titles are dropped (they only add tokens); validation constraints that
    structured outputs does not enforce stay in Pydantic, which re-validates the reply.
    """
    schema = copy.deepcopy(RoadmapDraft.model_json_schema())

    def clean(node: Any) -> None:
        if isinstance(node, dict):
            if isinstance(node.get("title"), str):  # an annotation, not a property named "title"
                del node["title"]
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}))
            for value in node.values():
                clean(value)
        elif isinstance(node, list):
            for value in node:
                clean(value)

    clean(schema)
    return schema


class ClaudeRoadmapModel:
    """One streamed call per turn; usage is accumulated across the call and its repair."""

    def __init__(self, client: Any, *, provider: str, model_id: str, effort: str = "medium",
                 max_tokens: int = 24000, cache_context: bool = False):
        self._client = client
        self.provider = provider
        self.model_id = model_id
        self._effort = effort
        self._max_tokens = max_tokens
        self._cache_context = cache_context
        self._schema = output_schema()

    def generate(self, compact: dict[str, Any]) -> ModelTurn:
        block: dict[str, Any] = {"type": "text", "text": build_user_message(compact)}
        if self._cache_context:
            # Only pays off when repairs are common: a cache write costs 1.25x input,
            # a cache read on the repair call costs 0.1x.
            block["cache_control"] = {"type": "ephemeral"}
        return self._call([{"role": "user", "content": [block]}], Usage())

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn:
        messages = [*turn.messages, {"role": "user", "content": build_repair_message(issues)}]
        return self._call(messages, turn.usage)

    def _call(self, messages: list[dict[str, Any]], usage: Usage) -> ModelTurn:
        import anthropic

        try:
            with self._client.messages.stream(
                model=self.model_id,
                max_tokens=self._max_tokens,
                system=SYSTEM_PROMPT,
                messages=messages,
                thinking={"type": "adaptive"},
                output_config={
                    "effort": self._effort,
                    "format": {"type": "json_schema", "schema": self._schema},
                },
            ) as stream:
                message = stream.get_final_message()
        except anthropic.RateLimitError as err:
            raise ModelError("MODEL_UNAVAILABLE", "The model is rate limited.", retryable=True) from err
        except anthropic.APIConnectionError as err:
            raise ModelError("MODEL_UNAVAILABLE", "The model could not be reached.", retryable=True) from err
        except anthropic.APIStatusError as err:
            retryable = err.status_code >= 500
            raise ModelError("MODEL_UNAVAILABLE", f"The model request failed ({err.status_code}).",
                             retryable=retryable) from err

        usage.add(message.usage)
        if message.stop_reason == "refusal":
            raise ModelError("MODEL_REFUSAL", "The model declined to create this roadmap.", usage=usage)
        if message.stop_reason == "max_tokens":
            raise ModelError("MODEL_OUTPUT_TRUNCATED", "The roadmap was longer than the output limit.", usage=usage)
        text = "".join(block.text for block in message.content if block.type == "text")
        try:
            draft = RoadmapDraft.model_validate_json(text)
        except ValueError as err:
            raise ModelError("MODEL_INVALID_OUTPUT", "The model returned an invalid roadmap.", usage=usage) from err
        history = [*messages, {"role": "assistant", "content": message.content}]
        return ModelTurn(draft=draft, usage=usage, messages=history)


def create_model(provider: str, *, model_id: str | None = None, aws_region: str | None = None,
                 effort: str = "medium", max_tokens: int = 24000, cache_context: bool = False) -> RoadmapModel:
    if provider == "mock":
        return MockRoadmapModel()
    if provider == "anthropic":
        import anthropic

        client = anthropic.Anthropic()
        return ClaudeRoadmapModel(client, provider=provider, model_id=model_id or DEFAULT_MODEL,
                                  effort=effort, max_tokens=max_tokens, cache_context=cache_context)
    if provider == "bedrock":
        if not aws_region:
            raise ValueError("ROADMAP_AWS_REGION is required for the bedrock provider")
        from anthropic import AnthropicBedrockMantle

        client = AnthropicBedrockMantle(aws_region=aws_region)
        return ClaudeRoadmapModel(client, provider=provider, model_id=model_id or DEFAULT_BEDROCK_MODEL,
                                  effort=effort, max_tokens=max_tokens, cache_context=cache_context)
    raise ValueError(f"Unknown roadmap provider: {provider}")


# --------------------------------------------------------------------------- mock


class MockRoadmapModel:
    """Builds a plausible roadmap from the context with fixed rules and no model call.

    Output passes the same validator as Claude's, so the API, persistence and frontend
    can be developed end to end for free. Wording is generic on purpose.
    """

    provider = "mock"
    model_id = "mock-roadmap-v1"
    HOURS = {"available": (8, 14), "outline_only": (12, 20)}

    def generate(self, compact: dict[str, Any]) -> ModelTurn:
        usage = Usage(calls=1)
        return ModelTurn(draft=self._plan(compact), usage=usage)

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn:
        raise ModelError("MODEL_INVALID_OUTPUT", "The mock roadmap failed validation: " + "; ".join(issues))

    def _plan(self, compact: dict[str, Any]) -> RoadmapDraft:
        budget_max = (compact["planning_budget"]["total_hours"] or [None, None])[1]
        sources = {s["chunk_id"]: s for s in compact["sources"]}
        goal = compact.get("goal") or {}
        hands_on = goal.get("preferred_learning_style") == "hands_on_projects"
        foundations = {f["skill_id"]: f for f in compact["foundations"]}

        steps: list[dict[str, Any]] = []
        deferred: list[dict[str, Any]] = []
        confirmations: list[dict[str, Any]] = []
        planned_hours = 0
        skill_keys: list[str] = []

        for main in sorted(compact["main_skills"], key=lambda m: m["rank"]):
            if main["recommendation"] != "candidate":
                continue
            low, high = self.HOURS.get(main["teaching_content"], (10, 16))
            if budget_max is not None and main["teaching_content"] == "outline_only" and budget_max < 80:
                deferred.append(_defer(main, "CONTENT_OUTLINE_ONLY",
                                       "Only a topic outline is available. Plan it once full lessons are ready."))
                continue
            if budget_max is not None and skill_keys and planned_hours + high > budget_max:
                deferred.append(_defer(main, "OUTSIDE_TIME_BUDGET",
                                       "This does not fit your current weekly time. Add it in your next roadmap."))
                continue

            check_keys = []
            for foundation_id in main["foundation_skill_ids"]:
                foundation = foundations.get(foundation_id)
                if not foundation or not _needs_check(foundation, main["skill_id"]):
                    continue
                key = f"check-{_slug(foundation['name'])}"
                if key not in {s["key"] for s in steps} and len(check_keys) < 2:
                    steps.append({
                        "key": key, "kind": "foundation_check", "skill_id": foundation_id,
                        "title": f"Check your {foundation['name']} basics",
                        "summary": f"{main['name']} material uses {foundation['name']}. Confirm you can use it before you start.",
                        "why": [f"Used in the {main['name']} tutorials you will follow."],
                        "hours_min": 1, "hours_max": 2, "depends_on": [],
                        "tasks": [{"title": f"Try a small {foundation['name']} exercise",
                                   "detail": "If it feels easy, mark this done and move on.",
                                   "task_kind": "check", "citations": []}],
                    })
                    planned_hours += 2
                    confirmations.append({"skill_id": foundation_id,
                                          "question": f"How comfortable are you with {foundation['name']}?"})
                if key in {s["key"] for s in steps}:
                    check_keys.append(key)

            tasks = []
            for claim in main["claims"][:3]:
                chunk_id = claim["chunk_ids"][0]
                source = sources.get(chunk_id)
                if source is None:
                    continue
                section = source["section"].split(" > ")[-1] or source["title"]
                quote = _first_sentence(source["content"])
                tasks.append({"title": f"Study: {section}"[:70],
                              "detail": f"Read this part of \"{source['title']}\".",
                              "task_kind": "learn",
                              "citations": [{"chunk_id": chunk_id, "quote": quote}]})
            if hands_on:
                tasks.append({"title": f"Practice {main['name']} on a small example",
                              "detail": "Repeat the tutorial steps on your own data.",
                              "task_kind": "practice", "citations": []})
            key = _slug(main["name"])
            market = main.get("market") or {}
            why = [f"Mentioned in {market.get('jobs_mentioning', 0)} of "
                   f"{compact['career']['jobs_in_market_sample']} recent {compact['career']['name']} job posts."]
            if main["gap_status"] == "missing_from_profile":
                why.append("Not in your profile yet.")
            steps.append({
                "key": key, "kind": "skill", "skill_id": main["skill_id"],
                "title": f"Learn {main['name']}", "summary": f"Work through the core {main['name']} concepts.",
                "why": why, "hours_min": low, "hours_max": high,
                "depends_on": check_keys + skill_keys[-1:], "tasks": tasks or [{
                    "title": f"Find the {main['name']} tutorial pages", "detail": "Full lessons are needed.",
                    "task_kind": "practice", "citations": []}],
            })
            planned_hours += high
            skill_keys.append(key)

        if hands_on and skill_keys:
            steps.append({
                "key": "portfolio-project", "kind": "project", "skill_id": None,
                "title": "Build a small portfolio project",
                "summary": "Combine what you learned into one project you can show employers.",
                "why": ["Turns your learning into evidence for your CV."],
                "hours_min": 4, "hours_max": 8, "depends_on": skill_keys[-1:],
                "tasks": [{"title": "Build and document the project", "detail": "Push it to GitHub with a README.",
                           "task_kind": "practice", "citations": []}],
            })

        first = steps[0]["key"] if steps else ""
        return RoadmapDraft.model_validate({
            "title": f"{compact['career']['name']} roadmap",
            "overview": "A focused plan built from your saved goal and current profile.",
            "planning_note": "Hours are rough estimates based on your saved weekly time.",
            "steps": steps,
            "next_action": {"step_key": first, "text": "Start with the first step this week."},
            "deferred": deferred,
            "confirmations": confirmations,
        })


def _needs_check(foundation: dict[str, Any], skill_id: int) -> bool:
    known = foundation["in_profile"] and foundation["user_level"] not in (None, "unknown")
    relevant = any(r["for_skill_id"] == skill_id and r["type"] != "related" for r in foundation["relationships"])
    return relevant and foundation["in_profile"] and not known


def _defer(main: dict[str, Any], reason: str, note: str) -> dict[str, Any]:
    return {"skill_id": main["skill_id"], "reason_code": reason, "note": note}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "step"


def _first_sentence(content: str) -> str:
    body = content.split("\n\n", 1)[-1].strip()
    sentence = re.split(r"(?<=[.!?])\s", body, maxsplit=1)[0]
    return sentence[:300]


def dump_schema() -> str:
    return json.dumps(output_schema(), indent=2)
