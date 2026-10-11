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
| Language / framework | **Python 3.12 + FastAPI** | The backend composes routes through `app/api/`; Resume API and job orchestration live in `app/features/resume/`, while reusable processing lives in `data-pipeline/src/resume/` |
| AI model | **Qwen VL** (default `qwen3-vl:8b`) served by Ollama or vLLM | Free to run locally, reads text and images, OpenAI-compatible, JSON-schema output |
| AI client | `openai` Python package (async) with `base_url` = the Qwen server | Works with Ollama, vLLM and LM Studio, and with vLLM on AWS later |
| Validation / schema | **Pydantic v2** (`data-pipeline/src/resume/schemas/cv_extraction.py`); `model_json_schema()` feeds the model's `response_format` | One schema for model output, API validation and OpenAPI. The frontend can generate TypeScript types from `/openapi.json` |
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
| `app/main.py` / `app/api/` | Standalone dev host and composition of feature routers |
| `app/features/resume/router.py` | CV upload, extraction-job, and profile endpoints; returns the documented error envelope |
| `app/features/resume/pipeline.py` | Orchestrates one API job: cache → limit → preprocess → extract → post-process, updating stages and deleting the upload |
| `data-pipeline/src/resume/parsing/` | Type detection, PDF text extraction, and scan/photo preparation as JPEG pages |
| `data-pipeline/src/resume/extraction/` | Extraction prompt, model input/output contract, and provider implementations |
| `data-pipeline/src/resume/normalization/` | Grounding, skill-name normalization, deduplication, evidence, and derived facts |
| `data-pipeline/src/resume/schemas/` | Pydantic extraction and profile contracts, the single source of truth |
| `app/features/resume/storage.py` / `services.py` | Local uploads, jobs/cache, profile JSON persistence, queue, and FastAPI dependency wiring |
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
