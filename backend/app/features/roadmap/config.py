"""Settings for roadmap generation. Read from environment variables / backend .env.

The mock Roadmap provider makes no generation call, but live RAG still calls
Gemini for query embeddings and evidence review. Roadmap model calls are guarded
by daily limits and a monthly budget computed from system.ai_runs.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RoadmapSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # mock = rule-based roadmap, no model call; gemini = Google Gemini API.
    # anthropic and bedrock remain available as alternate providers.
    ROADMAP_PROVIDER: Literal["mock", "gemini", "anthropic", "bedrock"] = "mock"
    ROADMAP_MODEL_ID: str | None = None  # Gemini default: gemini-3.8-flash
    ROADMAP_AWS_REGION: str | None = None
    ROADMAP_EFFORT: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    ROADMAP_MAX_TOKENS: int = Field(default=24000, ge=4000, le=128000)
    ROADMAP_CACHE_CONTEXT: bool = False

    # USD per million tokens. Defaults match Gemini 3.8 Flash introductory pricing
    # as of 2026-10; override these when pricing changes or another provider is used.
    ROADMAP_PRICE_INPUT_PER_MTOK: float = Field(default=0.75, ge=0)
    ROADMAP_PRICE_OUTPUT_PER_MTOK: float = Field(default=3.75, ge=0)

    # Paid-provider guards. 0 disables a limit. Reused roadmaps never count.
    ROADMAP_DAILY_LIMIT_PER_PROFILE: int = Field(default=20, ge=0)
    ROADMAP_DAILY_LIMIT: int = Field(default=100, ge=0)
    ROADMAP_MONTHLY_BUDGET_USD: float = Field(default=50.0, ge=0)

    # Agent Context is built from the authorized profile, market and live RAG evidence.
    ROADMAP_DATE_BASIS: Literal["posted_at", "first_seen_at"] = "first_seen_at"
    # Development only: use this saved Agent Context JSON instead of building one.
    ROADMAP_CONTEXT_FIXTURE: str | None = None


@lru_cache
def get_roadmap_settings() -> RoadmapSettings:
    return RoadmapSettings()
