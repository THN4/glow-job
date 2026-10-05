# CV Extraction — Plan

The CV Extraction feature turns an uploaded CV (PDF or image) into a structured, editable career profile, the same way an ID-card scanner turns a photo into pre-filled form fields. The user always checks and corrects the result before it is used.

This folder is the plan for the **backend function**. The frontend is out of scope for now, but the API and data contract are designed so the onboarding screens in Figma (Step 1 "Upload CV", the "Analyzing your CV" screen and Step 2 "Review Profile") can be built on top of it later without changes.

## Stack in one line

Developed in **Kiro** (spec-driven). Backend: **Python + FastAPI** (the team's stack), with CV extraction as one self-contained, mountable router. The AI is **Qwen VL running locally on the DevOps notebook server** (Ollama/vLLM, OpenAI-compatible API) at $0 cost. Later, DevOps **deploys to AWS** (API Gateway + Lambda + S3 + DynamoDB via CDK) with the same code, and the model host is chosen at deploy time with the $350 credit in mind.

## Where things live

| What | Where |
|---|---|
| Requirements (EARS format) | [.kiro/specs/cv-extraction/requirements.md](../../.kiro/specs/cv-extraction/requirements.md) |
| Design summary | [.kiro/specs/cv-extraction/design.md](../../.kiro/specs/cv-extraction/design.md) |
| **Task list (what to build, in order)** | [.kiro/specs/cv-extraction/tasks.md](../../.kiro/specs/cv-extraction/tasks.md) |
| Project context Kiro always loads | [.kiro/steering/](../../.kiro/steering/) (`product.md`, `tech.md`, `structure.md`) |
| Detailed reference docs | this folder ↓ |

| # | Document | What it covers | Main reader |
|---|---|---|---|
| 2 | [02-architecture.md](02-architecture.md) | Local mode vs AWS mode, components, request flow, config | Backend |
| 3 | [03-data-schema.md](03-data-schema.md) | **The `CvProfile` contract** shared by the backend and the future frontend | Backend + frontend |
| 4 | [04-api-spec.md](04-api-spec.md) | REST endpoints, upload → extract → poll → save, error codes, frontend notes | Backend + frontend |
| 5 | [05-extraction-pipeline.md](05-extraction-pipeline.md) | Preprocessing (text / page images), the Qwen call, prompt, grounding check | Backend |
| 6 | [06-aws-setup-and-cost.md](06-aws-setup-and-cost.md) | AWS deployment: model-hosting options A–D, costs vs the $350 credit, checklist | DevOps |
| 7 | [07-local-qwen-setup.md](07-local-qwen-setup.md) | Ollama/vLLM setup, model choice by VRAM, team access, smoke tests | DevOps |
| 8 | [08-database-mapping.md](08-database-mapping.md) | How the extraction output maps onto the team's PostgreSQL `app.*` tables, and the decisions to agree with the backend engineer | Backend |
| 9 | [09-fields-needed-from-cv.md](09-fields-needed-from-cv.md) | **Gap analysis:** which fields the database needs from a CV, what we extract today, what is missing (skill proficiency level first) and what to compute in code | Backend + AI |

## How to work on this in Kiro

1. Open the repo in Kiro. The steering files load automatically.
2. Open `.kiro/specs/cv-extraction/tasks.md`. **Task 0 is for DevOps** (Qwen server). Backend tasks 1–7 can start in parallel using `EXTRACTOR=mock`.
3. Tasks 0–9 are local only. Tasks 10–11 are the AWS deployment.
4. If you change a requirement, update `requirements.md` first, then ask Kiro to refresh `design.md` and `tasks.md`.

## Flow at a glance

```
 Upload file      Job queue (1 at a time)                       User reviews & fixes      Profile saved
 ───────────► ─►  PDF → text, or scan/photo → page images  ─►   (frontend, later)    ─►
                  Qwen VL extracts JSON (schema-constrained)    "Please confirm" on
                  grounding check + confidence per field        low-confidence fields
                  file deleted afterwards
```

| Figma screen | Backend piece that serves it |
|---|---|
| Step 1: Upload CV ("PDF, DOC, DOCX · Max 10 MB") | `POST /api/cv/uploads` → upload the file → `POST /api/cv/extractions` |
| Analyzing your CV (5 stages) | `GET /api/cv/extractions/{jobId}` returns the `stage` |
| Step 2: Review Profile (cards, "Please confirm", Edit) | `CvProfile` with per-item `confidence` / `needsReview` |
| "Looks good, continue" | `PUT /api/profiles` |
| "Continue without CV" | `GET /api/profiles/empty` |

## Key decisions

- **Local Qwen first, swappable later:** all model access goes through one `Extractor` interface (`mock` / `openai-compatible` / later `bedrock`). Moving to AWS is a config change.
- **Qwen can't read PDFs**, so text PDFs are sent as extracted text (fast) and scans/photos as page images (up to 4 pages, ≤ 1280 px).
- **Guarding a smaller model's output:** JSON-schema constrained output, Pydantic validation with one repair retry, and a **grounding check** that flags items not found in the CV text.
- **Mock extractor** means frontend and backend work doesn't depend on the notebook server being online, and tests and CI never call a model.
- **Same API in both modes:** upload, then an async job, then polling. This is required in AWS (Lambda's 6 MB limit, API Gateway timeout), so local mode uses the same shape and the frontend is written once.
- **Privacy:** uploaded files are deleted right after processing, job results expire after 1 hour, and the model server is private-network only. Only the profile the user confirms is kept.
