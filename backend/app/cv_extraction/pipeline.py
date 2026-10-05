"""Runs one extraction job: cache -> daily limit -> preprocess -> model -> post-process.

Never raises: failures are written to the job. The uploaded file is always deleted.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass

from .errors import AppError, to_app_error
from .extractors import Extractor
from .postprocess import BuildContext, build_result
from .preprocess import Limits, prepare_cv, sha256
from .storage import CacheRepo, JobsRepo, LocalUploadStore, UsageCounter

log = logging.getLogger("cv_extraction")

MODEL_STAGES = ["skills", "education", "experience"]


@dataclass
class Pipeline:
    uploads: LocalUploadStore
    jobs: JobsRepo
    cache: CacheRepo
    usage: UsageCounter
    extractor: Extractor
    limits: Limits
    daily_limit: int
    timeout_s: float
    #: How often the "Analyzing" stage advances while the model is working.
    stage_interval_s: float = 4.0

    async def run(self, job_id: str) -> None:
        job = self.jobs.get(job_id)
        if job is None:
            return
        started = time.monotonic()
        self.jobs.update(job_id, status="processing", stage="reading")
        stage_task: asyncio.Task | None = None
        try:
            async with asyncio.timeout(self.timeout_s):
                data = self.uploads.read(job.upload_id)
                if data is None:
                    raise AppError("UPLOAD_NOT_FOUND")

                file_hash = sha256(data)
                cached = self.cache.get(file_hash)
                if cached is not None:
                    cached.meta.extraction_id = job_id
                    cached.meta.cached = True
                    cached.meta.duration_ms = _ms(started)
                    self.jobs.update(job_id, status="succeeded", stage="building", result=cached)
                    self._log("extraction.cached", jobId=job_id)
                    return

                if self.daily_limit > 0 and self.usage.increment_today() > self.daily_limit:
                    raise AppError("DAILY_LIMIT_REACHED")

                prepared = await asyncio.to_thread(prepare_cv, data, self.limits)

                # A single model call has no section-by-section progress: advance the stage on a timer.
                self.jobs.update(job_id, stage=MODEL_STAGES[0])
                stage_task = asyncio.create_task(self._advance_stages(job_id))

                model_started = time.monotonic()
                out = await self.extractor.extract(prepared)
                stage_task.cancel()
                if not out.extraction.is_document_a_cv:
                    raise AppError("NOT_A_CV")

                self.jobs.update(job_id, stage="building")
                result = build_result(
                    out.extraction,
                    BuildContext(
                        extraction_id=job_id,
                        model=self.extractor.name,
                        duration_ms=_ms(started),
                        input_kind=prepared.kind,
                        page_count=prepared.page_count,
                        source_text=prepared.text if prepared.kind == "text" and self.extractor.groundable else None,
                        warnings=list(prepared.warnings),
                    ),
                )
                self.cache.put(file_hash, result)
                self.jobs.update(job_id, status="succeeded", stage="building", result=result)
                # Metadata only: never log CV content.
                self._log(
                    "extraction.succeeded",
                    jobId=job_id,
                    model=self.extractor.name,
                    inputKind=prepared.kind,
                    pageCount=prepared.page_count,
                    modelMs=_ms(model_started),
                    totalMs=_ms(started),
                    inputTokens=out.usage.input_tokens if out.usage else None,
                    outputTokens=out.usage.output_tokens if out.usage else None,
                    reviewCount=result.meta.review_count,
                )
        except TimeoutError:
            self._fail(job_id, AppError("EXTRACTION_TIMEOUT"), started)
        except Exception as err:  # noqa: BLE001 - every failure must end up on the job
            app_err = to_app_error(err)
            if app_err.code == "INTERNAL_ERROR":
                log.exception("unexpected error in job %s", job_id)
            self._fail(job_id, app_err, started)
        finally:
            if stage_task:
                stage_task.cancel()
            try:
                self.uploads.delete(job.upload_id)
            except OSError:
                pass

    async def _advance_stages(self, job_id: str) -> None:
        for stage in MODEL_STAGES[1:]:
            await asyncio.sleep(self.stage_interval_s)
            self.jobs.update(job_id, stage=stage)

    def _fail(self, job_id: str, err: AppError, started: float) -> None:
        self.jobs.update(job_id, status="failed", error=err.to_body())
        self._log("extraction.failed", jobId=job_id, code=err.code, totalMs=_ms(started))

    @staticmethod
    def _log(msg: str, **data: object) -> None:
        log.info("%s %s", msg, json.dumps({k: v for k, v in data.items() if v is not None}))


def _ms(since: float) -> int:
    return round((time.monotonic() - since) * 1000)

