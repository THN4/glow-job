"""Wires local mode together (in-process queue, temp-folder uploads, JSON-file profiles).

``get_services`` is a FastAPI dependency: tests (or a deployed app) can replace it with
``app.dependency_overrides[get_services] = ...``.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.features.resume.config import CvSettings, get_settings
from app.features.resume.pipeline import Pipeline
from app.features.resume.storage import (
    CacheRepo,
    FileProfilesRepo,
    JobQueue,
    JobsRepo,
    LocalUploadStore,
    UsageCounter,
    default_upload_dir,
)
from src.resume.extraction.contracts import Extractor
from src.resume.extraction.providers import create_extractor
from src.resume.parsing.preprocess import Limits


@dataclass
class Services:
    settings: CvSettings
    uploads: LocalUploadStore
    jobs: JobsRepo
    cache: CacheRepo
    usage: UsageCounter
    profiles: FileProfilesRepo
    queue: JobQueue
    extractor: Extractor


def build_services(
    settings: CvSettings,
    *,
    extractor: Extractor | None = None,
    upload_dir: Path | None = None,
    stage_interval_s: float = 4.0,
) -> Services:
    uploads = LocalUploadStore(upload_dir or default_upload_dir(), settings.PUBLIC_BASE_URL, settings.API_PREFIX)
    uploads.init()
    extractor = extractor or create_extractor(settings)
    jobs, cache, usage = JobsRepo(), CacheRepo(), UsageCounter()
    pipeline = Pipeline(
        uploads=uploads,
        jobs=jobs,
        cache=cache,
        usage=usage,
        extractor=extractor,
        limits=Limits(settings.MAX_PDF_PAGES, settings.MAX_IMAGE_PAGES),
        daily_limit=settings.DAILY_EXTRACTION_LIMIT,
        # Model timeout plus headroom for preprocessing and one repair retry.
        timeout_s=settings.LLM_TIMEOUT_MS / 1000 * 2 + 30,
        stage_interval_s=stage_interval_s,
    )
    return Services(
        settings=settings,
        uploads=uploads,
        jobs=jobs,
        cache=cache,
        usage=usage,
        profiles=FileProfilesRepo(Path(settings.DATA_DIR) / "profiles.json"),
        queue=JobQueue(pipeline.run),
        extractor=extractor,
    )


@lru_cache
def get_services() -> Services:
    return build_services(get_settings())
