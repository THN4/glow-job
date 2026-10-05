"""API integration tests: the full upload -> extract -> poll -> save flow with the mock extractor."""

import asyncio

import httpx
import pytest
from fastapi import FastAPI

from app.cv_extraction import router as cv_router
from app.cv_extraction.config import CvSettings
from app.cv_extraction.extractors.mock import MockExtractor, mock_extraction
from app.cv_extraction.schemas import CvExtractionResult
from app.cv_extraction.services import Services, build_services, get_services

from .fixtures import make_cv_image, make_text_pdf


def make_app(tmp_path, extractor=None, **env) -> tuple[FastAPI, Services]:
    settings = CvSettings(_env_file=None, EXTRACTOR="mock", MOCK_DELAY_MS=0, DATA_DIR=str(tmp_path / "data"), **env)
    svc = build_services(
        settings,
        extractor=extractor or MockExtractor(0),
        upload_dir=tmp_path / "uploads",
        stage_interval_s=0.005,
    )
    app = FastAPI()
    app.include_router(cv_router, prefix="/api")  # exactly how the team's app would mount it
    app.dependency_overrides[get_services] = lambda: svc
    return app, svc


class Flow:
    def __init__(self, client: httpx.AsyncClient, svc: Services):
        self.c, self.svc = client, svc

    async def upload(self, data: bytes, content_type="application/pdf") -> str:
        r = await self.c.post("/api/cv/uploads", json={"fileName": "cv", "contentType": content_type, "size": len(data)})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["upload"]["method"] == "PUT"
        put = await self.c.put(body["upload"]["url"], content=data, headers=body["upload"]["headers"])
        assert put.status_code == 204, put.text
        return body["uploadId"]

    async def extract(self, data: bytes, content_type="application/pdf") -> dict:
        upload_id = await self.upload(data, content_type)
        r = await self.c.post("/api/cv/extractions", json={"uploadId": upload_id})
        assert r.status_code == 202
        job_id = r.json()["jobId"]
        await self.svc.queue.join()
        poll = (await self.c.get(f"/api/cv/extractions/{job_id}")).json()
        return {"jobId": job_id, "uploadId": upload_id, **poll}


@pytest.fixture
async def flow(tmp_path):
    app, svc = make_app(tmp_path)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8787") as c:
        yield Flow(c, svc)


async def test_full_flow(flow: Flow):
    poll = await flow.extract(make_text_pdf())
    assert poll["status"] == "succeeded"
    CvExtractionResult.model_validate(poll["result"])
    assert poll["result"]["meta"]["inputKind"] == "text"
    assert any(s["name"] == "React" for s in poll["result"]["profile"]["technicalSkills"])
    # new fields for the database (docs/cv-extraction/09-fields-needed-from-cv.md), camelCase on the wire
    skills = {s["name"]: s for s in poll["result"]["profile"]["technicalSkills"]}
    assert skills["JavaScript"]["proficiency"] == "advanced" and skills["JavaScript"]["proficiencyBasis"] == "explicit"  # mock: model-stated
    assert isinstance(skills["React"]["evidence"], list)
    derived = poll["result"]["profile"]["derived"]
    assert {"yearsExperience", "currentJobTitle", "educationLevel", "fieldOfStudy", "suggestedStatus"} <= derived.keys()
    assert derived["educationLevel"] == "bachelor" and derived["currentJobTitle"] == "Freelance Web Developer"
    # The uploaded file is deleted after processing.
    assert flow.svc.uploads.read(poll["uploadId"]) is None


async def test_repeated_file_is_served_from_cache(flow: Flow):
    pdf = make_text_pdf()
    await flow.extract(pdf)
    poll = await flow.extract(pdf)
    assert poll["result"]["meta"]["cached"] is True


async def test_upload_request_validation(flow: Flow):
    c = flow.c
    r = await c.post("/api/cv/uploads", json={"fileName": "a.exe", "contentType": "application/x-msdownload", "size": 10})
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    r = await c.post("/api/cv/uploads", json={"fileName": "a.pdf", "contentType": "application/pdf", "size": 50 * 1024 * 1024})
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"
    r = await c.post("/api/cv/uploads", json={"fileName": "a.pdf"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_REQUEST"


async def test_uploaded_content_must_be_pdf_or_image(flow: Flow):
    r = await flow.c.post("/api/cv/uploads", json={"fileName": "cv.pdf", "contentType": "application/pdf", "size": 11})
    body = r.json()
    put = await flow.c.put(body["upload"]["url"], content=b"hello world", headers=body["upload"]["headers"])
    assert put.status_code == 415 and put.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


async def test_oversized_upload_is_rejected_while_streaming(tmp_path):
    app, svc = make_app(tmp_path, MAX_FILE_MB=0.001)  # ~1 KB
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8787") as c:
        r = await c.post("/api/cv/uploads", json={"fileName": "cv.pdf", "contentType": "application/pdf", "size": 500})
        body = r.json()
        put = await c.put(body["upload"]["url"], content=make_text_pdf(), headers=body["upload"]["headers"])
        assert put.status_code == 413


async def test_start_without_uploaded_file(flow: Flow):
    r = await flow.c.post("/api/cv/uploads", json={"fileName": "cv.pdf", "contentType": "application/pdf", "size": 100})
    r = await flow.c.post("/api/cv/extractions", json={"uploadId": r.json()["uploadId"]})
    assert r.status_code == 404 and r.json()["error"]["code"] == "UPLOAD_NOT_FOUND"


async def test_unknown_job(flow: Flow):
    r = await flow.c.get("/api/cv/extractions/job_nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "JOB_NOT_FOUND"


async def test_save_and_load_profile(flow: Flow):
    poll = await flow.extract(make_text_pdf())
    saved = await flow.c.put("/api/profiles", json={"sessionId": "s1", "profileId": None, "profile": poll["result"]["profile"]})
    assert saved.status_code == 200
    profile_id = saved.json()["profileId"]
    loaded = (await flow.c.get(f"/api/profiles/{profile_id}")).json()
    assert loaded["profile"]["education"][0]["needsReview"] is False
    assert loaded["profile"]["derived"]["currentJobTitle"] == "Freelance Web Developer"  # recomputed on save

    edited = {**loaded["profile"], "summary": "Edited"}
    r = await flow.c.put("/api/profiles", json={"sessionId": "s1", "profileId": profile_id, "profile": edited})
    assert r.status_code == 200
    assert (await flow.c.get(f"/api/profiles/{profile_id}")).json()["profile"]["summary"] == "Edited"


async def test_invalid_profile_returns_field_details(flow: Flow):
    r = await flow.c.put("/api/profiles", json={"sessionId": "s1", "profile": {"schemaVersion": 1}})
    body = r.json()
    assert r.status_code == 400 and body["error"]["code"] == "INVALID_PROFILE"
    assert len(body["error"]["details"]) > 0


async def test_unknown_profile_id_on_update(flow: Flow):
    empty = (await flow.c.get("/api/profiles/empty")).json()["profile"]
    r = await flow.c.put("/api/profiles", json={"sessionId": "s1", "profileId": "prf_nope", "profile": empty})
    assert r.status_code == 404 and r.json()["error"]["code"] == "PROFILE_NOT_FOUND"


async def test_empty_profile_for_continue_without_cv(flow: Flow):
    r = await flow.c.get("/api/profiles/empty")
    assert r.json()["profile"]["education"] == []


# --------------------------------------------------------------------------- pipeline failures


class NotACvExtractor:
    name, groundable = "fake", True

    async def extract(self, prepared):
        from app.cv_extraction.extractors.base import ExtractorOutput

        ex = mock_extraction()
        ex.is_document_a_cv = False
        return ExtractorOutput(extraction=ex)


async def test_not_a_cv_fails_the_job(tmp_path):
    app, svc = make_app(tmp_path, extractor=NotACvExtractor())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8787") as c:
        poll = await Flow(c, svc).extract(make_text_pdf())
        assert poll["status"] == "failed" and poll["error"]["code"] == "NOT_A_CV"


class SlowExtractor:
    name, groundable = "slow", True

    async def extract(self, prepared):
        await asyncio.sleep(5)


async def test_timeout_fails_the_job(tmp_path):
    app, svc = make_app(tmp_path, extractor=SlowExtractor(), LLM_TIMEOUT_MS=100)
    svc.queue._handler.__self__.timeout_s = 0.2  # keep the test fast (pipeline deadline)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8787") as c:
        poll = await Flow(c, svc).extract(make_text_pdf())
        assert poll["status"] == "failed" and poll["error"]["code"] == "EXTRACTION_TIMEOUT"
        assert poll["error"]["retryable"] is True


async def test_daily_limit(tmp_path):
    app, svc = make_app(tmp_path, DAILY_EXTRACTION_LIMIT=1)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8787") as c:
        flow = Flow(c, svc)
        await flow.extract(make_text_pdf())
        upload_id = await flow.upload(make_cv_image(), "image/png")
        r = await c.post("/api/cv/extractions", json={"uploadId": upload_id})
        assert r.status_code == 429 and r.json()["error"]["code"] == "DAILY_LIMIT_REACHED"
