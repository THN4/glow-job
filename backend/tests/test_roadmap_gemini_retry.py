from ai.roadmap.contracts import RoadmapDraft
from ai.roadmap.providers import GeminiRoadmapModel, ModelError, ModelTurn, Usage


def test_gemini_retries_truncated_output_once_at_provider_limit(monkeypatch):
    model = GeminiRoadmapModel(client=None, model_id="gemini-3.8-flash", max_tokens=24_000)
    limits = []

    def call(_contents, usage, *, max_output_tokens):
        limits.append(max_output_tokens)
        usage.calls += 1
        usage.output_tokens += max_output_tokens
        if len(limits) == 1:
            raise ModelError("MODEL_OUTPUT_TRUNCATED", "truncated", usage=usage)
        return ModelTurn(draft=RoadmapDraft.model_construct(), usage=usage)

    monkeypatch.setattr(model, "_call", call)
    result = model.generate({})

    assert limits == [24_000, 65_536]
    assert result.usage.calls == 2
    assert result.usage.output_tokens == 24_000 + 65_536


def test_gemini_does_not_retry_truncation_at_provider_limit(monkeypatch):
    model = GeminiRoadmapModel(client=None, model_id="gemini-3.8-flash", max_tokens=65_536)
    calls = []

    def call(_contents, usage, *, max_output_tokens):
        calls.append(max_output_tokens)
        raise ModelError("MODEL_OUTPUT_TRUNCATED", "truncated", usage=usage)

    monkeypatch.setattr(model, "_call", call)

    try:
        model.generate({})
    except ModelError as error:
        assert error.code == "MODEL_OUTPUT_TRUNCATED"
    else:
        raise AssertionError("Expected truncation failure")

    assert calls == [65_536]
