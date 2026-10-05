"""Settings for the CV extraction feature. Read from environment variables / backend .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class CvSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # mock = fixture data, no model server (tests, frontend work)
    # openai-compatible = Qwen on the DevOps notebook server (Ollama / vLLM)
    # ollama = Ollama's native API (sets context size and thinking per request): recommended for the notebook server
    EXTRACTOR: Literal["mock", "openai-compatible", "ollama"] = "mock"
    MOCK_DELAY_MS: int = 3000

    LLM_BASE_URL: str | None = None
    LLM_MODEL: str | None = None
    LLM_API_KEY: str = "not-needed"
    LLM_TIMEOUT_MS: int = 180_000
    LLM_VISION: bool = True
    # Ollama only: context window per request (keep small, or big models spill out of GPU memory) and thinking on/off.
    LLM_NUM_CTX: int = 16384
    LLM_THINK: bool = False

    # Used to build the local upload URL returned to the client.
    CORS_ORIGINS: str = "http://localhost:5173"
    PUBLIC_BASE_URL: str = "http://localhost:8787"
    API_PREFIX: str = "/api"
    DATA_DIR: str = ".data"

    MAX_FILE_MB: float = 10
    MAX_PDF_PAGES: int = 10
    MAX_IMAGE_PAGES: int = 4
    DAILY_EXTRACTION_LIMIT: int = 0  # 0 = unlimited (local)

    @model_validator(mode="after")
    def _check_llm(self) -> "CvSettings":
        if self.EXTRACTOR in ("openai-compatible", "ollama") and not (self.LLM_BASE_URL and self.LLM_MODEL):
            raise ValueError(f"EXTRACTOR={self.EXTRACTOR} requires LLM_BASE_URL and LLM_MODEL")
        return self

    @property
    def max_file_bytes(self) -> int:
        return round(self.MAX_FILE_MB * 1024 * 1024)


@lru_cache
def get_settings() -> CvSettings:
    return CvSettings()
