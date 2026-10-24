"""Estimate the USD cost of one generation from token usage.

Defaults match Gemini 3.8 Flash introductory API prices per million tokens as of
2026-10. Override the settings if prices change or another provider is selected.
"""

from __future__ import annotations

from dataclasses import dataclass

from ai.roadmap.providers import Usage


@dataclass(frozen=True)
class Pricing:
    input_per_mtok: float = 0.75
    output_per_mtok: float = 3.75
    cache_write_multiplier: float = 1.25
    cache_read_multiplier: float = 0.1


def pricing_for_model(provider: str, model_id: str | None, *, input_price: float | None = None,
                      output_price: float | None = None) -> Pricing:
    """Use known Amazon Nova rates for Converse, keeping existing providers' defaults.

    Nova Pro standard inference is $0.80/$3.20 and Nova 2 Lite is $0.33/$2.75
    per million tokens in us-east-1. Explicit prices win; unknown Converse models
    require prices rather than inheriting Gemini rates.
    """
    defaults = Pricing()
    if provider == "bedrock_converse":
        if model_id and "amazon.nova-pro-v1:" in model_id:
            defaults = Pricing(0.8, 3.2)
        elif model_id and "amazon.nova-2-lite-v1:" in model_id:
            defaults = Pricing(0.33, 2.75)
        elif input_price is None or output_price is None:
            raise ValueError("Set both ROADMAP_PRICE_INPUT_PER_MTOK and ROADMAP_PRICE_OUTPUT_PER_MTOK for this Converse model")
    return Pricing(input_price if input_price is not None else defaults.input_per_mtok,
                   output_price if output_price is not None else defaults.output_per_mtok)


def estimate_cost(usage: Usage, pricing: Pricing, *, provider: str) -> float:
    if provider == "mock":
        return 0.0
    per_input = pricing.input_per_mtok / 1_000_000
    cost = (
        usage.input_tokens * per_input
        + usage.cache_creation_input_tokens * per_input * pricing.cache_write_multiplier
        + usage.cache_read_input_tokens * per_input * pricing.cache_read_multiplier
        + usage.output_tokens * pricing.output_per_mtok / 1_000_000
    )
    return round(cost, 6)
