"""Settings for the CV extraction feature. Read from environment variables / backend .env."""

from __future__ import annotations

from functools import lru_cache
from pydantic import Field
from pydantic_settings import SettingsConfigDict

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
    MATCH_MIN_TOTAL_JOBS: int = Field(default=10, ge=0)
    MATCH_MAX_MARKET_AGE_DAYS: int = Field(default=180, ge=0)
    MATCH_MIN_LEVEL_OBSERVATIONS: int = Field(default=3, ge=0)
    MATCH_MIN_TARGET_LEVEL_CONFIDENCE: float = Field(default=0.6, ge=0, le=1)

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
