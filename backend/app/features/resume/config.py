"""Settings for the CV extraction feature. Read from environment variables / backend .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import SettingsConfigDict
from rag.context.match_policy import (
    MATCH_MAX_MARKET_AGE_DAYS,
    MATCH_MIN_LEVEL_OBSERVATIONS,
    MATCH_MIN_TARGET_LEVEL_CONFIDENCE,
    MATCH_MIN_TOTAL_JOBS,
)

from src.resume.config import ResumeModelSettings


class CvSettings(ResumeModelSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Used to build the local upload URL returned to the client.
    CORS_ORIGINS: str = "http://localhost:5173"
    PUBLIC_BASE_URL: str = "http://localhost:8787"
    API_PREFIX: str = "/api"
    DATA_DIR: str = ".data"

    MAX_FILE_MB: float = 10
    DAILY_EXTRACTION_LIMIT: int = 0  # 0 = unlimited (local)

    # Optional connection used to read the shared skill catalog and persist
    # confirmed profiles. Local extraction falls back to JSON without it.
    DB_HOST: str | None = None
    DB_PORT: int | None = None
    DB_NAME: str | None = None
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None

    # Initial, configurable quality gates for the demo career match. Coverage
    # remains available with small samples; low-quality inputs are disclosed.
    MATCH_MIN_TOTAL_JOBS: int = Field(default=MATCH_MIN_TOTAL_JOBS, ge=0)
    MATCH_MAX_MARKET_AGE_DAYS: int = Field(default=MATCH_MAX_MARKET_AGE_DAYS, ge=0)
    MATCH_MIN_LEVEL_OBSERVATIONS: int = Field(default=MATCH_MIN_LEVEL_OBSERVATIONS, ge=0)
    MATCH_MIN_TARGET_LEVEL_CONFIDENCE: float = Field(
        default=float(MATCH_MIN_TARGET_LEVEL_CONFIDENCE), ge=0, le=1
    )

    # Step checks: draft questions with a model when a study task has none (docs/assessments/question-bank.md).
    # off by default, so nothing calls a model unless it is switched on.
    ASSESSMENT_AI_GENERATION: Literal["off", "gemini"] = "off"
    ASSESSMENT_DAILY_GENERATIONS: int = Field(default=50, ge=0)  # chunks per day, about two model calls each
    ASSESSMENT_GENERATION_TIMEOUT_S: float = Field(default=20, gt=0)

    @property
    def database_configured(self) -> bool:
        return all(
            str(value or "").strip()
            for value in (self.DB_HOST, self.DB_PORT, self.DB_NAME, self.DB_USER, self.DB_PASSWORD)
        )

    @property
    def skill_catalog_configured(self) -> bool:
        return self.database_configured

    @property
    def max_file_bytes(self) -> int:
        return round(self.MAX_FILE_MB * 1024 * 1024)


@lru_cache
def get_settings() -> CvSettings:
    return CvSettings()
