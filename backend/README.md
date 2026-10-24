# Glow Job backend (FastAPI): CV Extraction

Turns an uploaded CV (PDF or image) into a structured, editable career profile.
For the current extraction scope and domain boundary, see
[`data-pipeline/docs/resume/`](../data-pipeline/docs/resume/README.md). The
cross-layer API, schema, and database references are indexed in
[`docs/cv-extraction/`](../docs/cv-extraction/README.md).

The Resume API is exposed from `app/features/resume/` and composed through
`app/api/`. Reusable parsing, extraction contracts, schemas, and normalization
live in the sibling `data-pipeline/src/resume/` package. Resume processing
commands live in `data-pipeline/scripts/resume/` and run from the data-pipeline
repository root. Backend-only API, job orchestration, and storage code live in
`app/features/resume/`.

Backend layout:

| Path | Responsibility |
|---|---|
| `app/api/` | Compose and register feature routers. |
| `app/features/resume/` | Resume HTTP routes, job orchestration, settings, and local persistence. |
| `app/features/documents/` | Reserved for future document/RAG-facing API behavior. |
| `app/shared/` | Backend-only infrastructure shared by multiple features. |

Initialize the submodule from the `glow-job` repository root before starting
the backend:

```bash
git submodule update --init --recursive data-pipeline
```

In the team's FastAPI app, mount the composed API router with one line:

```python
from app.api.router import router as api_router
app.include_router(api_router, prefix="/api")
```

`app/main.py` is a standalone development host (FastAPI + CORS + health). The
current local configuration uses Bedrock Converse with Nova 2 Lite for CV
extraction. Gemini remains an optional CV extraction provider; `mock` avoids
model calls for UI work and tests. Market, roadmap, and assessment behavior is
described in the root [project overview](../README.md).

## Setup

For integrated local development, follow the root repository's
[Docker Compose instructions](../README.md#run-the-web-app-locally). Compose
reads the root `.env` and passes settings to the backend. For direct host
execution, install the requirements below and provide the needed environment
variables in the shell; a `.env` file, if present, is read from the `backend/`
working directory. Use `DB_HOST=localhost` to reach a locally published
PostgreSQL port.

```bash
cd backend
py -3.12 -m venv .venv            # Windows: use the py launcher so you get a regular CPython 3.12
.\.venv\Scripts\Activate.ps1            # (macOS/Linux: python3.12 -m venv .venv ; source .venv/bin/activate)
python --version                  # must say 3.12.x (not an MSYS/MinGW Python)
pip install -r requirements-dev.txt
```

> **Windows pitfall:** if plain `python` on your PATH is the MSYS/MinGW Python (`C:\msys64\...`), a venv made with it can't install PyMuPDF/Pillow wheels, and re-running `python -m venv .venv` over an existing venv wipes its packages. Symptoms: `No module named 'uvicorn'` / `No module named '_pytest'`. Fix: `py -3.12 -m venv --clear .venv`, then `pip install -r requirements-dev.txt` again.

`.env`:

| Variable | Use |
|---|---|
| `RESUME_EXTRACTOR=bedrock_converse` | Current text extraction provider; defaults to Nova 2 Lite |
| `RESUME_EXTRACTOR=mock` | Fixture data, no model call. Use for tests and frontend work |
| `RESUME_EXTRACTOR=gemini` | Optional Gemini CV extraction provider |
| `BEDROCK_EXTRACTION_MODEL` | Bedrock model ID for CV extraction; defaults to `us.amazon.nova-2-lite-v1:0` |
| `AWS_BEARER_TOKEN_BEDROCK` or AWS credentials/role | Bedrock authentication; use a role for deployed workloads |
| `AWS_DEFAULT_REGION` | Bedrock region; defaults to `us-east-1` |
| `GEMINI_API_KEY` | Needed by Gemini extraction or Gemini Embedding 2 retrieval |
| `RESUME_GEMINI_TIMEOUT_MS`, `RESUME_BEDROCK_TIMEOUT_MS` | Provider request timeouts |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Optional database connection. When configured, the backend reads the shared skill catalog, persists anonymous extraction job status/results, and saves confirmed profiles to `app.*`; apply all database migrations first. If omitted, skill matches are not returned, extraction jobs stay in memory, and profiles use the local JSON-file fallback. |
| `MATCH_MIN_TOTAL_JOBS`, `MATCH_MAX_MARKET_AGE_DAYS`, `MATCH_MIN_LEVEL_OBSERVATIONS`, `MATCH_MIN_TARGET_LEVEL_CONFIDENCE` | Initial quality gates for market sample and target proficiency level. Defaults are 10 jobs, 180 days, 3 level observations, and 0.6 confidence; low-quality inputs are disclosed in the match response. |

Set `RESUME_EXTRACTOR=bedrock_converse` and provide Bedrock credentials for the
current Nova setup. Choose `RESUME_EXTRACTOR=mock` when you want to avoid CV
model calls. The Gemini provider is available by setting
`RESUME_EXTRACTOR=gemini` and `GEMINI_API_KEY`.

All model options with defaults are in [`data-pipeline/src/resume/config.py`](../data-pipeline/src/resume/config.py). Backend API-specific settings remain in `app/features/resume/config.py`.


## Commands

| Command | What it does |
|---|---|
| `uvicorn app.main:app --reload --port 8787` | API on http://localhost:8787/api. Swagger UI at `/docs`, OpenAPI at `/openapi.json` |
| `pytest` | Backend API and service integration tests. Resume domain/provider tests live in `data-pipeline/tests/resume/`. |
| `python -m tests.fixtures` | Writes a few small synthetic CVs to `tests/generated/` (used by quick checks) |
| `python -m tests.make_sample_cvs` | (Re)generates the 10 fictional sample CVs in `test_cvs/` (Thai, two-column, scan, photo, not-a-CV...). See [test_cvs/README.md](test_cvs/README.md) |
| `python -m scripts.resume.extract ../backend/tests/generated/sample-cv.pdf` (run from `data-pipeline/`) | Runs one file through preprocess → model → post-process and prints the JSON (no server needed) |
| `python -m scripts.resume.extract ../backend/test_cvs/01-fullstack-developer-en.pdf --summary` (run from `data-pipeline/`) | Same, but prints a compact view laid out like the database tables (user_profiles, educations, experiences, skills with level + basis + evidence) |
| `python -m scripts.resume.try_api ../backend/tests/generated/sample-cv.pdf` (run from `data-pipeline/`) | Walks the full API flow (upload → extract → poll) against the running server |

## API (summary)

```
POST /api/cv/uploads                  { fileName, contentType, size } -> { uploadId, upload: { method, url, headers } }
PUT  /api/cv/uploads/{uploadId}/file  raw file body (local-mode upload target)
POST /api/cv/extractions              { uploadId, sessionId } -> 202 { jobId }
GET  /api/cv/extractions/{jobId}      (header: X-Session-Id) -> { status, stage, result?, error? }
GET  /api/profiles/empty              -> { profile }
PUT  /api/profiles                    { sessionId, profileId?, profile } -> { profileId, updatedAt }
GET  /api/profiles/{profileId}        -> { profileId, updatedAt, profile }
GET  /api/profiles/{profileId}/progress-overview (header: X-Session-Id) -> saved skill/evidence counts, analysis and market dates, recent activity
GET  /api/career-profiles             -> active career profiles with market stats
GET  /api/profiles/{profileId}/career-match?careerProfileId=12 (header: X-Session-Id) -> Core 20 + broader market coverage and level alignment (requires DB)
GET  /api/health
```

Full spec and error codes: [docs/cv-extraction/03-api-reference.md](../docs/cv-extraction/03-api-reference.md). JSON is camelCase. Every error has the shape `{"error": {"code", "message", "retryable"}}`.

## Historical model-server measurements (2026-10-05)

These measurements document the earlier notebook-server prototype. They are
kept as project history and should not be treated as current model-selection or
deployment guidance; see the current resume scope documentation before choosing
or configuring a provider.

| Input | Model | Result |
|---|---|---|
| 1-page text PDF | `qwen2.5-coder:7b` (text-only) | All sections correct, ~81 s |
| Same file again | (cache) | Instant, `cached: true` |
| Receipt PDF | `qwen2.5-coder:7b` | `NOT_A_CV` in ~10 s |
| Scanned CV (image) | `gemma4:e4b` | Failed: the Gemma vision models never receive the image on this server |
| Scanned CV (image) | `vegeta/qwen3.5-4b-mtp:q8`, `LLM_NUM_CTX=16384`, thinking off | **Read correctly** (name, school, skills, projects, no invented jobs), ~2.5 min including the first model load |
| Same model with the server default context (131k) | `vegeta/qwen3.5-4b-mtp:q8` via `/v1` | Timed out: only 18 % of the model fit on the GPU. The prototype fix was Ollama's 16k context setting. |

Sample CVs and their evaluation notes: [test_cvs/README.md](test_cvs/README.md).

## Notes

The direct extraction CLI reads model settings from environment variables or
`data-pipeline/.env`; the backend API reads its `.env` from `backend/`.

- Files are deleted right after processing. Logs contain metadata only. Never commit real CVs: use `python -m tests.fixtures`.
- Jobs and the result cache live in memory (1 h / 24 h) and uploads in a temp folder, so restarting the server clears them. With DB settings configured and migrations through `009` applied, confirmed profiles are saved to `app.user_profiles` and related `app.*` tables; the full profile payload is retained in `app.user_profiles.profile_data`. Without DB settings, profiles fall back to `.data/profiles.json`.
- PyMuPDF (PDF text and rendering) is AGPL-licensed: fine for the hackathon, but check the license before a closed-source release.

## Testing Command

cd C:\path\to\glow-job\backend
.venv\Scripts\activate

pytest

cd ..\data-pipeline
python -m scripts.resume.extract ..\backend\test_cvs\01-fullstack-developer-en.pdf --summary

cd ..\backend
uvicorn app.main:app --port 8787

cd ..\data-pipeline
python -m scripts.resume.try_api ..\backend\test_cvs\01-fullstack-developer-en.pdf


