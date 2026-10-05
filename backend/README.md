# Glow Job backend (FastAPI): CV Extraction

Turns an uploaded CV (PDF or image) into a structured, editable career profile.
Design docs: [docs/cv-extraction/](../docs/cv-extraction/). Kiro spec: [.kiro/specs/cv-extraction/](../.kiro/specs/cv-extraction/).

The feature is one self-contained package, `app/cv_extraction/`. In the team's FastAPI app it mounts with one line:

```python
from app.cv_extraction import router as cv_router
app.include_router(cv_router, prefix="/api")
```

`app/main.py` is a standalone dev host for it (FastAPI + CORS + health). The AI model is Qwen on the DevOps notebook server, reached through its OpenAI-compatible API. AWS mode comes later.

## Setup

```bash
cd backend-py
py -3.12 -m venv .venv            # Windows: use the py launcher so you get a regular CPython 3.12
.venv\Scriptsctivate            # (macOS/Linux: python3.12 -m venv .venv ; source .venv/bin/activate)
python --version                  # must say 3.12.x (not an MSYS/MinGW Python)
pip install -r requirements-dev.txt
copy .env.example .env            # then edit it (macOS/Linux: cp)
```

> **Windows pitfall:** if plain `python` on your PATH is the MSYS/MinGW Python (`C:\msys64\...`), a venv made with it can't install PyMuPDF/Pillow wheels, and re-running `python -m venv .venv` over an existing venv wipes its packages. Symptoms: `No module named 'uvicorn'` / `No module named '_pytest'`. Fix: `py -3.12 -m venv --clear .venv`, then `pip install -r requirements-dev.txt` again.

`.env`:

| Variable | Use |
|---|---|
| `EXTRACTOR=mock` | Fixture data, no model server needed. Use for frontend work and when the notebook server is offline |
| `EXTRACTOR=ollama` | **Recommended for the notebook server.** Ollama's native API: the backend sets the context size (`LLM_NUM_CTX`) and thinking (`LLM_THINK`) per request. `LLM_BASE_URL` is the plain address, e.g. `http://192.168.1.144:11434` |
| `EXTRACTOR=openai-compatible` | Any OpenAI-style server (vLLM, LM Studio, or Ollama's `/v1`). `LLM_BASE_URL` ends in `/v1` |
| `LLM_MODEL` | The **full tag** from `ollama list`, e.g. `vegeta/qwen3.5-4b-mtp:q8` (reads text and images). A shortened name gives "model not found" |
| `LLM_VISION` | `true` if the model can read images. `false` for text-only models (`qwen2.5-coder`): scans/photos are then rejected with a clear message |

All options with defaults are in [`app/cv_extraction/config.py`](app/cv_extraction/config.py).

## Commands (venv active, from `backend-py/`)

| Command | What it does |
|---|---|
| `uvicorn app.main:app --reload --port 8787` | API on http://localhost:8787/api. Swagger UI at `/docs`, OpenAPI at `/openapi.json` |
| `pytest` | All tests, about 3 s. They use the mock model and a fake HTTP transport, no network |
| `python -m tests.fixtures` | Writes a few small synthetic CVs to `tests/generated/` (used by quick checks) |
| `python -m tests.make_sample_cvs` | (Re)generates the 10 sample CVs in `test_cvs/` (Thai, two-column, scan, photo, not-a-CV...). See [test_cvs/README.md](test_cvs/README.md) |
| `python -m app.scripts.extract tests/generated/sample-cv.pdf` | Runs one file through preprocess → model → post-process and prints the JSON (no server needed) |
| `python -m app.scripts.extract test_cvs/01-fullstack-developer-en.pdf --summary` | Same, but prints a compact view laid out like the database tables (user_profiles, educations, experiences, skills with level + basis + evidence) |
| `python -m app.scripts.try_api tests/generated/sample-cv.pdf` | Walks the full API flow (upload → extract → poll) against the running server |

## API (summary)

```
POST /api/cv/uploads                  { fileName, contentType, size } -> { uploadId, upload: { method, url, headers } }
PUT  /api/cv/uploads/{uploadId}/file  raw file body (local-mode upload target)
POST /api/cv/extractions              { uploadId } -> 202 { jobId }
GET  /api/cv/extractions/{jobId}      -> { status, stage, result?, error? }
GET  /api/profiles/empty              -> { profile }
PUT  /api/profiles                    { sessionId, profileId?, profile } -> { profileId, updatedAt }
GET  /api/profiles/{profileId}        -> { profileId, updatedAt, profile }
GET  /api/health
```

Full spec and error codes: [docs/cv-extraction/04-api-spec.md](../docs/cv-extraction/04-api-spec.md). JSON is camelCase. Every error has the shape `{"error": {"code", "message", "retryable"}}`.

## Measured on the DevOps server (2026-10-05)

| Input | Model | Result |
|---|---|---|
| 1-page text PDF | `qwen2.5-coder:7b` (text-only) | All sections correct, ~81 s |
| Same file again | (cache) | Instant, `cached: true` |
| Receipt PDF | `qwen2.5-coder:7b` | `NOT_A_CV` in ~10 s |
| Scanned CV (image) | `gemma4:e4b` | Failed: the Gemma vision models never receive the image on this server |
| Scanned CV (image) | `vegeta/qwen3.5-4b-mtp:q8`, `LLM_NUM_CTX=16384`, thinking off | **Read correctly** (name, school, skills, projects, no invented jobs), ~2.5 min including the first model load |
| Same model with the server default context (131k) | `vegeta/qwen3.5-4b-mtp:q8` via `/v1` | Timed out: only 18 % of the model fit on the GPU. Fixed by `EXTRACTOR=ollama` (16k context) |

Per-file results for the 10 sample CVs (time 13-107 s each, all correct): [test_cvs/README.md](test_cvs/README.md).

## Notes

- Files are deleted right after processing. Logs contain metadata only. Never commit real CVs: use `python -m tests.fixtures`.
- Jobs and the result cache live in memory (1 h / 24 h) and uploads in a temp folder, so restarting the server clears them. Saved profiles go to `.data/profiles.json`.
- PyMuPDF (PDF text and rendering) is AGPL-licensed: fine for the hackathon, but check the license before a closed-source release.

## Testing Command

cd C:\Users\putte\Documents\GitHub\glow-job\backend-py
.venv\Scripts\activate

pytest

python -m app.scripts.extract test_cvs\01-fullstack-developer-en.pdf --summary

uvicorn app.main:app --port 8787

python -m app.scripts.try_api test_cvs\01-fullstack-developer-en.pdf


