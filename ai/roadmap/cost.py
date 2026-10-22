"""Estimate the USD cost of one generation from token usage.

Defaults are Anthropic API list prices for Claude Opus 5.5 per million tokens. Amazon
Bedrock prices are set by AWS and can differ: set ROADMAP_PRICE_* from the Bedrock
pricing page for the chosen region before relying on these numbers.
"""

from __future__ import annotations

from dataclasses import dataclass

from ai.roadmap.providers import Usage


@dataclass(frozen=True)
class Pricing:
    input_per_mtok: float = 4.0
    output_per_mtok: float = 20.0
    cache_write_multiplier: float = 1.25
    cache_read_multiplier: float = 0.1


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
