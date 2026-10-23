"""Model providers for roadmap generation.

- ``mock``: deterministic, rule-based roadmap from the context. Costs nothing; default
  for local development, tests and frontend work.
- ``gemini``: Gemini through Google's Gen AI SDK and GEMINI_API_KEY.
- ``anthropic``: Claude through the Anthropic API (ANTHROPIC_API_KEY or `ant auth login`).
- ``bedrock``: Claude through Amazon Bedrock (AWS credential chain; region required).

Gemini uses structured JSON output and a configurable thinking level. The SDKs are
imported lazily so the mock path runs without a live model connection.
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
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"


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


class GeminiRoadmapModel:
    """Generate schema-constrained roadmap drafts with the Google Gen AI SDK."""

    def __init__(self, client: Any, *, model_id: str, effort: str = "medium", max_tokens: int = 24000):
        self._client = client
        self.provider = "gemini"
        self.model_id = model_id
        self._effort = effort if effort in {"low", "medium", "high"} else "high"
        self._max_tokens = max_tokens

    def generate(self, compact: dict[str, Any]) -> ModelTurn:
        text = build_user_message(compact)
        return self._call([{"role": "user", "parts": [{"text": text}]}], Usage())

    def repair(self, turn: ModelTurn, issues: list[str]) -> ModelTurn:
        contents = [*turn.messages, {"role": "user", "parts": [{"text": build_repair_message(issues)}]}]
        return self._call(contents, turn.usage)

    def _call(self, contents: list[dict[str, Any]], usage: Usage) -> ModelTurn:
        from google.genai import errors, types

        try:
            response = self._client.models.generate_content(
                model=self.model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    # Gemini's protobuf `response_schema` does not accept the
                    # `additionalProperties` field emitted by Pydantic. Pass the
                    # standard JSON Schema through the dedicated JSON Schema field;
                    # local Pydantic validation still enforces the full contract.
                    response_json_schema=RoadmapDraft.model_json_schema(),
                    max_output_tokens=self._max_tokens,
                    thinking_config=types.ThinkingConfig(thinking_level=self._effort),
                ),
            )
        except errors.APIError as err:
            code = getattr(err, "code", 0) or 0
            retryable = code == 429 or code >= 500
            message = "The Gemini model is rate limited." if code == 429 else "The Gemini request failed."
            raise ModelError("MODEL_UNAVAILABLE", message, retryable=retryable, usage=usage) from err
        except (TimeoutError, OSError) as err:
            raise ModelError("MODEL_UNAVAILABLE", "The Gemini model could not be reached.",
                             retryable=True, usage=usage) from err

        usage.calls += 1
        metadata = getattr(response, "usage_metadata", None)
        if metadata is not None:
            usage.input_tokens += getattr(metadata, "prompt_token_count", 0) or 0
            usage.output_tokens += (getattr(metadata, "candidates_token_count", 0) or 0)
            usage.output_tokens += (getattr(metadata, "thoughts_token_count", 0) or 0)

        candidates = getattr(response, "candidates", None) or []
        finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
        reason_name = getattr(finish_reason, "name", str(finish_reason or "")).upper()
        feedback = getattr(response, "prompt_feedback", None)
        block_reason = getattr(feedback, "block_reason", None)
        block_name = getattr(block_reason, "name", str(block_reason or "")).upper()
        refusal_reasons = {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}
        if reason_name in refusal_reasons or block_name in refusal_reasons:
            raise ModelError("MODEL_REFUSAL", "Gemini could not provide a roadmap for this request.", usage=usage)
        if reason_name == "MAX_TOKENS":
            raise ModelError("MODEL_OUTPUT_TRUNCATED", "The roadmap was longer than the output limit.", usage=usage)

        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            raise ModelError("MODEL_INVALID_OUTPUT", "Gemini returned no roadmap JSON.", usage=usage)
        try:
            draft = RoadmapDraft.model_validate_json(text)
        except ValueError as err:
            raise ModelError("MODEL_INVALID_OUTPUT", "Gemini returned an invalid roadmap.", usage=usage) from err

        history = [*contents, {"role": "model", "parts": [{"text": text}]}]
        return ModelTurn(draft=draft, usage=usage, messages=history)


def create_model(provider: str, *, model_id: str | None = None, aws_region: str | None = None,
                 effort: str = "medium", max_tokens: int = 24000, cache_context: bool = False) -> RoadmapModel:
    if provider == "mock":
        return MockRoadmapModel()
    if provider == "gemini":
        import os
        from google import genai

        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        return GeminiRoadmapModel(genai.Client(api_key=api_key), model_id=model_id or DEFAULT_GEMINI_MODEL,
                                  effort=effort, max_tokens=max_tokens)
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

    Output passes the same validator as the model providers, so the API, persistence and frontend
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

        for skill in compact.get("completed_skills", []):
            details = []
            if skill.get("teaching_content") == "available":
                for claim in skill.get("claims", [])[:3]:
                    chunk_id = next((chunk_id for chunk_id in claim.get("chunk_ids", [])
                                     if chunk_id in sources), None)
                    source = sources.get(chunk_id) if chunk_id is not None else None
                    if source is None:
                        continue
                    quote = _first_sentence(source["content"])
                    if len(quote.strip()) < 20:
                        continue
                    details.append({
                        "title": source["section"].split(" > ")[-1] or source["title"],
                        "detail": claim["text"],
                        "citations": [{"chunk_id": chunk_id, "quote": quote}],
                    })
            key = f"completed-{_slug(skill['name'])}"
            confirmed_level = skill.get("current_level", "unknown")
            is_market_covered = skill.get("gap_status") == "covered"
            if is_market_covered:
                summary = (f"Your profile confirms {skill['name']} at {confirmed_level}; "
                           f"the market target is {skill['target_level']}.")
                why = ["Your confirmed profile level meets the current market target."]
            else:
                summary = (f"Your profile confirms {skill['name']}. "
                           "Your proficiency level and market alignment have not been verified.")
                why = ["This skill is already listed in your confirmed profile."]
            steps.append({
                "key": key, "kind": "completed_skill", "skill_id": skill["skill_id"],
                "title": skill["name"],
                "summary": summary,
                "why": why,
                "hours_min": 0, "hours_max": 0, "depends_on": [], "tasks": [], "details": details,
            })

        for main in sorted(compact["main_skills"], key=lambda m: m["rank"]):
            if main["recommendation"] == "needs_confirmation" or main["rag_status"] in {
                "error", "not_reviewed", "insufficient_evidence",
            }:
                deferred.append(_defer(
                    main, "NEEDS_CONFIRMATION",
                    "Reviewed learning content is not available yet. Add or review sources before planning this skill.",
                ))
                continue
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
                mandatory = any(r["for_skill_id"] == main["skill_id"]
                                and r.get("blocks_unconditional_progress")
                                and r.get("runtime_role") == "global_ordering"
                                for r in foundation["relationships"])
                if key not in {s["key"] for s in steps} and (len(check_keys) < 2 or mandatory):
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
                "depends_on": check_keys, "tasks": tasks or [{
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
                "hours_min": 4, "hours_max": 8, "depends_on": list(skill_keys),
                "tasks": [{"title": "Build and document the project", "detail": "Push it to GitHub with a README.",
                           "task_kind": "practice", "citations": []}],
            })

        first = next((step["key"] for step in steps if step["kind"] != "completed_skill"),
                     steps[0]["key"] if steps else "")
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
    relevant = any(
        r["for_skill_id"] == skill_id and r["type"] != "related"
        and (foundation["in_profile"] or r.get("blocks_unconditional_progress"))
        for r in foundation["relationships"]
    )
    return relevant and not known


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
