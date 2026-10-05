# 2. Architecture

The system runs in two modes from **one codebase**:

| | **Local mode (now)** | **AWS mode (at deploy, by DevOps)** |
|---|---|---|
| AI model | **Qwen VL on the DevOps notebook server** (Ollama/vLLM, OpenAI-compatible API) | Chosen at deploy time (see [06-aws-setup-and-cost.md](06-aws-setup-and-cost.md)) |
| API | FastAPI + Uvicorn | The same FastAPI app behind API Gateway / a container (DevOps decides) |
| Background jobs | In-process queue, concurrency 1 | Worker Lambda (async invoke) |
| File upload | Local temp folder (upload URL points back to the API) | S3 presigned POST |
| Data | In-memory TTL maps / JSON file | DynamoDB |
| Cost | $0 | See 06 |

Switching modes is configuration only (`EXTRACTOR`, `STORAGE`, `LLM_*`). Routes and services don't change.

## 2.1 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Dev environment | **Kiro** (spec-driven: requirements → design → tasks) | Team standard. Specs in `.kiro/specs/`, context in `.kiro/steering/` |
| Language / framework | **Python 3.12 + FastAPI** | The team's backend is FastAPI. The CV feature is one self-contained package (`app/cv_extraction/`) mounted with `app.include_router(...)` |
| AI model | **Qwen VL** (default `qwen3-vl:8b`) served by Ollama or vLLM | Free to run locally, reads text and images, OpenAI-compatible, JSON-schema output |
| AI client | `openai` Python package (async) with `base_url` = the Qwen server | Works with Ollama, vLLM and LM Studio, and with vLLM on AWS later |
| Validation / schema | **Pydantic v2** (`schemas.py`); `model_json_schema()` feeds the model's `response_format` | One schema for model output, API validation and OpenAPI. The frontend can generate TypeScript types from `/openapi.json` |
| Document processing | **PyMuPDF** (PDF text + render scans to images), Pillow (images), `filetype` (magic bytes) | Qwen can't read PDFs, so we turn them into text or images ourselves. PyMuPDF is AGPL-licensed (check before a closed-source release) |
| AWS (deploy) | API Gateway, Lambda, S3, DynamoDB, CDK v2, CloudWatch, Budgets | Serverless, ~$0 when idle |
| Testing | pytest + pytest-asyncio + httpx | Model server faked with `httpx.MockTransport` |

**Deliberately not used:** Textract (Qwen-VL reads scans), Step Functions, RDS, NAT Gateway, OpenSearch, WAF, Cognito (no auth in this phase).

## 2.2 Local mode

```
 Developer machines (frontend / backend devs)                 DevOps notebook server
┌─────────────────────────────────────────────┐   Tailscale  ┌────────────────────────────┐
│ Browser ──► FastAPI (localhost:8787)        │   / LAN      │ Ollama or vLLM             │
│               ├─ local upload folder (tmp)  │ ───────────► │ qwen3-vl:8b                │
│               ├─ in-process job queue (1)   │  /v1/chat/   │ context 16k, 1 at a time   │
│               └─ in-memory repos            │  completions └────────────────────────────┘
└─────────────────────────────────────────────┘
```

The backend can also run **on the notebook server itself**, next to Ollama, and teammates point their frontend at it. Either way works.

## 2.3 AWS mode

```
┌────────────┐  HTTPS   ┌────────────────┐    ┌──────────────┐  async invoke  ┌──────────────┐
│ Frontend   │────────► │ API Gateway    │───►│ API Lambda   │───────────────►│ Worker       │──► Model (option A/B/C/D,
│            │◄──────── │ HTTP API       │    │ (FastAPI)    │                │ Lambda 300 s │     see 06-aws-setup-and-cost.md)
└─────┬──────┘          └────────────────┘    └──────┬───────┘                └──┬────────┬──┘
      │ presigned POST                               ▼                           │        │
      └────────────────────────────► S3 uploads ◄──── DynamoDB GlowJob ◄─────────┘        │
                                     (private,       (jobs, cache, profiles, counters)   get + delete
                                      1-day expiry)  ◄─────────────────────────────────────┘
```

Why presigned upload + async worker (AWS mode): a synchronous Lambda request is limited to **6 MB** (our limit is 10 MB), and API Gateway's integration timeout (~30 s) is shorter than an extraction. Polling also gives the "Analyzing your CV" screen its real stages. Local mode uses **the same API shape**, so the frontend can't tell the difference.

## 2.4 Components

| Component | Responsibility |
|---|---|
| `app/main.py` | Standalone dev entry: FastAPI + CORS + health + the CV router. In the team's app, only `include_router` is needed |
| `cv_extraction/router.py` | All endpoints (`/cv/uploads`, `PUT /cv/uploads/{id}/file` (local mode), `/cv/extractions`, `/profiles`). `EnvelopeRoute` produces the `{error:{code,message,retryable}}` body, so no app-level exception handler is needed |
| `cv_extraction/pipeline.py` | Orchestrates one job: cache → limit → preprocess → extract → post-process, updating stages. Never raises (failures go on the job); always deletes the upload |
| `cv_extraction/preprocess.py` | Type detection, PDF text extraction, scan/photo → JPEG pages |
| `cv_extraction/extractors/` | `Extractor` interface + `mock.py`, `openai_compatible.py` (Qwen), later `bedrock.py` |
| `cv_extraction/postprocess.py` | Grounding check, normalize, dedupe, IDs, `needsReview`, meta |
| `cv_extraction/storage.py` | Local implementations: uploads (temp folder), jobs/cache (TTL maps), profiles (JSON file), asyncio job queue (concurrency 1, starts lazily). AWS versions are added in the deploy phase behind the same method names |
| `cv_extraction/services.py` | `get_services()` FastAPI dependency (override it in tests) |
| `cv_extraction/schemas.py` | Pydantic models, the single source of truth |
| `infra/` | Infrastructure code (AWS mode only, written by DevOps) |

## 2.5 Request flow (same in both modes)

1. `POST /api/cv/uploads` → `{ uploadId, upload: { method, url, fields? } }`. In AWS mode this is an S3 presigned POST. In local mode it is `PUT /api/cv/uploads/{id}/file` on the local API.
2. The client uploads the file to `upload.url`.
3. `POST /api/cv/extractions { uploadId }` → `202 { jobId }`. The job is queued (local queue / worker Lambda).
4. The pipeline runs: `reading` → hash/cache → preprocess → `skills`/`education`/`experience` (advanced on a timer during the model call) → post-process (`building`) → `succeeded`/`failed`. The uploaded file is **deleted in `finally`**.
5. `GET /api/cv/extractions/{jobId}` is polled every ~1.5 s, for up to 300 s.
6. `PUT /api/profiles` saves the confirmed profile.

## 2.6 Configuration

| Env var | Local default | AWS | Notes |
|---|---|---|---|
| `EXTRACTOR` | `openai-compatible` (or `mock` with no model server) | depends on option | `mock` = fixtures, used in tests/CI |
| `LLM_BASE_URL` | `http://<notebook-host>:11434/v1` | option B/C | OpenAI-compatible endpoint |
| `LLM_MODEL` | `qwen3-vl:8b` | option-specific | |
| `LLM_API_KEY` | (empty) | secret (SSM/Secrets Manager) if the server requires one | |
| `LLM_TIMEOUT_MS` | `180000` | `180000` | |
| `STORAGE` | `local` | `aws` | |
| `MAX_FILE_MB` / `MAX_PDF_PAGES` / `MAX_IMAGE_PAGES` | `10` / `10` / `4` | same | |
| `DAILY_EXTRACTION_LIMIT` | `0` (unlimited) | e.g. `50` | Credit protection when deployed |
| `CORS_ORIGINS` | `http://localhost:5173` | the frontend URL | |
| `TABLE_NAME`, `UPLOAD_BUCKET`, `WORKER_FUNCTION_NAME` | — | set by CDK | |
