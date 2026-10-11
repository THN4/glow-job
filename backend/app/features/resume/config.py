"""Settings for the CV extraction feature. Read from environment variables / backend .env."""

from __future__ import annotations

from functools import lru_cache
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

    @property
    def max_file_bytes(self) -> int:
        return round(self.MAX_FILE_MB * 1024 * 1024)


@lru_cache
def get_settings() -> CvSettings:
    return CvSettings()
