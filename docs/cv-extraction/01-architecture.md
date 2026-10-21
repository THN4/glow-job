# Resume/CV Architecture

This document describes the implemented local development flow. The current
code boundaries are split between the main backend and the `data-pipeline`
sub-repository. The frontend flow described here is a temporary local demo for
inspecting extraction and market matching; it is not the planned production UI.

## Components

| Component | Responsibility |
|---|---|
| `frontend/src/features/resume/` | Temporary demo UI at `/onboarding/cv` for CV upload, extraction review, saving, and inspecting career-match results. |
| `backend/app/features/resume/` | FastAPI routes, temporary uploads, in-process extraction jobs, profile persistence, and the read-only market-match API. |
| `data-pipeline/src/resume/` | Reusable CV parsing, extraction contracts/providers, validation, normalization, and profile schemas. |
| PostgreSQL `core` and `market` schemas | Canonical skill catalog, career profiles, and market skill statistics. |
| PostgreSQL `app` schema | Confirmed user profiles, normalized skills, skill evidence, and related profile data. |

## Request flow

1. The browser requests an upload target and uploads the CV to the backend.
2. The backend queues an in-process extraction job and the browser polls its status.
3. The extraction pipeline validates and preprocesses the file, calls the configured extractor, then validates and normalizes the result.
4. The user reviews and confirms the extracted profile. The backend saves it to PostgreSQL when database settings are configured; direct local runs can use JSON file fallback storage.
5. The user selects a career profile. The backend compares confirmed canonical skills with that profile's latest market-statistics window and returns separate coverage and proficiency measures. This calculation uses SQL and does not use RAG.

The demo UI is only a client of these backend flows. A replacement frontend can
use the same extraction, profile, career-profile, and career-match APIs; its
screens and interaction design do not need to follow the demo page.

## Runtime configuration

- When the stack runs with the root `compose.yaml`, Docker Compose reads the
  root `.env` and passes database and extractor settings to the backend.
- When running Uvicorn directly from `backend/`, the backend reads
  `backend/.env` (or environment variables already set in the shell).
- `RESUME_EXTRACTOR=mock` supports local UI development without model calls;
  `RESUME_EXTRACTOR=gemini` uses the configured Gemini API key.

CV files are temporary and deleted after extraction. Extraction jobs and cache
entries are held in memory; only a user-confirmed profile is persisted.
