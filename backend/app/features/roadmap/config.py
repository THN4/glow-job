"""Settings for roadmap generation. Read from environment variables / backend .env.

Defaults cost nothing: the mock provider makes no model call. Paid providers are
guarded by daily limits and a monthly budget computed from system.ai_runs.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RoadmapSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # mock = rule-based roadmap, no model call (local development and tests)
    # anthropic = Claude through the Anthropic API; bedrock = Claude through Amazon Bedrock
    ROADMAP_PROVIDER: Literal["mock", "anthropic", "bedrock"] = "mock"
    ROADMAP_MODEL_ID: str | None = None  # default: claude-opus-5-5 / anthropic.claude-opus-5-5
    ROADMAP_AWS_REGION: str | None = None
    ROADMAP_EFFORT: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    ROADMAP_MAX_TOKENS: int = Field(default=24000, ge=4000, le=128000)
    ROADMAP_CACHE_CONTEXT: bool = False

    # USD per million tokens. Defaults are Anthropic API list prices for Opus 5.5;
    # replace with the Bedrock price for the chosen region before deployment.
    ROADMAP_PRICE_INPUT_PER_MTOK: float = Field(default=4.0, ge=0)
    ROADMAP_PRICE_OUTPUT_PER_MTOK: float = Field(default=20.0, ge=0)

    # Paid-provider guards. 0 disables a limit. Reused roadmaps never count.
    ROADMAP_DAILY_LIMIT_PER_PROFILE: int = Field(default=3, ge=0)
    ROADMAP_DAILY_LIMIT: int = Field(default=30, ge=0)
    ROADMAP_MONTHLY_BUDGET_USD: float = Field(default=50.0, ge=0)

    # Agent Context inputs. Knowledge is prepared per career profile ahead of time
    # (scripts.rag.prepare_skill_context) and saved as career-profile-<id>.json.
    ROADMAP_KNOWLEDGE_DIR: str = "../rag/data/knowledge"
    ROADMAP_DATE_BASIS: Literal["posted_at", "first_seen_at"] = "first_seen_at"
    # Development only: use this saved Agent Context JSON instead of building one.
    ROADMAP_CONTEXT_FIXTURE: str | None = None


@lru_cache
def get_roadmap_settings() -> RoadmapSettings:
    return RoadmapSettings()
