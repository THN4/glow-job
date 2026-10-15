# API Reference

The implemented local API runs at `http://localhost:8787`; all paths are prefixed with `/api`, and JSON uses `camelCase`. This reference covers the current local backend. Types refer to [02-profile-schema.md](02-profile-schema.md).

## 3.1 The flow

```
1. POST /api/cv/uploads            → where and how to upload the file
2. upload the file to `upload.url` → local API
3. POST /api/cv/extractions        → 202 { jobId }
4. GET  /api/cv/extractions/{id}   → poll until status is succeeded or failed
5. PUT  /api/profiles              → save what the user confirmed
```

## 3.2 `POST /api/cv/uploads`

Asks for permission to upload one file.

**Request**
```json
{ "fileName": "my-cv.pdf", "contentType": "application/pdf", "size": 482113 }
```

**Response `201`**:
```json
{
  "uploadId": "upl_7b1e…",
  "upload": { "method": "PUT", "url": "http://localhost:8787/api/cv/uploads/upl_7b1e…/file", "headers": { "Content-Type": "application/pdf" } },
  "expiresInSeconds": 300
}
```

The current demo frontend uploads the raw file as the request body using the returned `PUT` URL and headers. A replacement client uses the same API sequence.

## 3.3 `POST /api/cv/extractions`

Starts the analysis of an uploaded file.

**Request**: `{ "uploadId": "upl_7b1e…" }`

**Response `202`**: `{ "jobId": "job_93c2…", "status": "queued" }`

## 3.4 `GET /api/cv/extractions/{jobId}`

Poll every ~1.5 s, and stop after `succeeded`/`failed` or after the configured job timeout. While `status` is `queued`, another CV is being processed first (the local worker runs one at a time).

**Response `200`** (processing)
```json
{ "jobId": "job_93c2…", "status": "processing", "stage": "education" }
```

`stage` is one of `reading`, `skills`, `education`, `experience`, `building`, matching the 5 rows of the "Analyzing your CV" screen.

**Response `200`** (succeeded)
```json
{
  "jobId": "job_93c2…",
  "status": "succeeded",
  "stage": "building",
  "result": {
    "profile": { "schemaVersion": 1, "personal": { "…": "…" }, "education": [], "…": "…" },
    "meta": {
      "extractionId": "job_93c2…",
      "model": "qwen3-vl:8b",
      "durationMs": 18420,
      "inputKind": "text",
      "cached": false,
      "detectedLanguage": "en",
      "pageCount": 2,
      "warnings": [],
      "reviewCount": 1
    }
  }
}
```

When database access is configured, `technicalSkills[]` and `tools[]`
include `catalogMatch`, resolved deterministically against the same
`core.skills` and `core.skill_aliases` catalog used by Market. A match includes
the canonical `skillId`, `canonicalName`, and `matchMethod`; no match is
`{"status":"unmatched"}`. If catalog access is not configured,
`catalogMatch` is `null`. This lookup never creates or changes catalog rows.

**Response `200`** (failed)
```json
{ "jobId": "job_93c2…", "status": "failed", "error": { "code": "NOT_A_CV", "message": "This document does not look like a CV.", "retryable": false } }
```

Job records (including the extracted result) are deleted automatically **1 hour** after creation. The frontend must save with `PUT /api/profiles` to keep the data.

## 3.5 `GET /api/profiles/empty`

Returns an empty `CvProfile` (all lists `[]`, scalars `null`), for **"Continue without CV"**.

## 3.6 `PUT /api/profiles`

Saves the profile after the user has reviewed and edited it ("Looks good, continue").

**Request**
```json
{ "sessionId": "f93efc05-e67b-47a7-a81a-c9834d6d8b85", "profileId": null, "profile": { "schemaVersion": 1, "…": "…" } }
```

- `profileId: null` creates a new profile. Passing an existing id updates it.
- The body is validated against `CvProfile`. Invalid input returns `400 INVALID_PROFILE` with field paths in `error.details`.
- The backend ignores any client-supplied `catalogMatch` and recomputes it from
  the current catalog before saving. It never trusts a client-provided `skillId`.
- Every item gets `needsReview: false` on save, because the user has now confirmed it.
- `sessionId` identifies the anonymous user in the current product flow. The backend uses it as `auth_subject` with `auth_provider='anonymous'`; clients should generate and retain a hard-to-guess UUID. Losing it means the anonymous profile cannot be recovered.
- When database settings and the required app schema are present, the confirmed profile is saved to `app.user_profiles` and normalized child tables. Without database settings, direct local runs store profiles in `.data/profiles.json`.

**Response `200`**: `{ "profileId": "prf_51aa…", "updatedAt": "2026-10-05T10:00:00Z" }`

## 3.7 `GET /api/profiles/{profileId}`

Returns `{ "profileId", "updatedAt", "profile": CvProfile }`, or `404 PROFILE_NOT_FOUND`.

## 3.8 `GET /api/health`

Returns `{ "status": "ok", "extractor": "mock" }` (the extractor value depends on backend configuration).

## 3.9 Errors

One envelope everywhere (for job failures it appears under `error` in the poll response):

```json
{ "error": { "code": "FILE_TOO_LARGE", "message": "File exceeds 10 MB.", "retryable": false } }
```

| HTTP | `code` | When | Suggested UI message |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | Missing or invalid body fields | "Something is missing. Please try again." |
| 400 | `INVALID_PROFILE` | Profile fails schema validation | Highlight the fields from `details` |
| 413 | `FILE_TOO_LARGE` | Declared size > 10 MB | "Your file is over 10 MB. Try a smaller PDF or a compressed image." |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not a PDF/JPG/PNG/WEBP (declared, or detected by the worker) | "We support PDF, JPG and PNG." |
| 404 | `UPLOAD_NOT_FOUND` | Unknown/expired `uploadId`, or the file was never uploaded | "Upload expired. Please choose your file again." |
| 404 | `JOB_NOT_FOUND` / `PROFILE_NOT_FOUND` | Unknown id (or the job expired) | Restart the flow |
| 429 | `DAILY_LIMIT_REACHED` | The daily extraction cap (credit protection) is used up | "We've reached today's limit. Please try again tomorrow or fill in your profile manually." (`retryable: false`) |
| 503 | `SKILL_CATALOG_UNAVAILABLE` | Catalog access is configured but the DB is unreachable, empty, or invalid | Retry later; do not treat skills as unmatched |
| 503 | `PROFILE_STORE_UNAVAILABLE` | The configured DB could not save or load the confirmed profile | Retry later; the profile was not saved |
| 503 | `CAREER_MATCH_UNAVAILABLE` | Career matching needs the shared DB, or the profile/market query failed | Retry later or configure the shared database |
| — (job) | `TOO_MANY_PAGES` | PDF > 10 pages | "Your CV is longer than 10 pages." |
| — (job) | `UNREADABLE_DOCUMENT` | Blank, encrypted or corrupt file | "We couldn't read this file. Try a clearer scan or a PDF." |
| — (job) | `NOT_A_CV` | The model judged it is not a CV/résumé | "This doesn't look like a CV. Please check the file." |
| — (job) | `EXTRACTION_DECLINED` | Provider declines the extraction | "We couldn't process this file." |
| — (job) | `EXTRACTION_FAILED` | Provider error after retries, or invalid output | "Something went wrong. Please try again." (`retryable: true`) |
| — (job) | `EXTRACTION_TIMEOUT` | Worker exceeded the configured extraction timeout | Same as above (`retryable: true`) |

## 3.10 Client integration notes

The current `/onboarding/cv` page is a temporary demo for inspecting extraction
and match results. These steps describe how a client can use the API; they do
not require a replacement frontend to copy the demo's screens or UX. Treat the
backend routes and `/openapi.json` as the contract, and keep the new client's
types aligned with them.

1. **Upload step:** the demo implements this at `/onboarding/cv`; any client can call `uploads` → upload the file with the returned PUT URL and headers → call `extractions`.
2. **Analyzing screen:** poll the job and tick off rows as `stage` advances. Show "This usually takes less than a minute".
3. **Review step:** render one card per section of `result.profile`. For each technical skill/tool, show the matched canonical catalog name when `catalogMatch.status === "matched"`; retain the extracted label as the user's wording. Show an unmatched state when status is `unmatched`, and a neutral “catalog not checked” state when `catalogMatch` is `null`. Unmatched catalog entries are flagged `needsReview` for the user's attention. Use `meta.reviewCount` and `meta.warnings` for a summary banner.
4. **Edit:** keep the profile in local state (e.g. React Hook Form). Set `source: "user"` on any item the user edits or adds.
5. **Continue:** `PUT /api/profiles`, store the `profileId`, then continue onboarding.
6. **Continue without CV:** `GET /api/profiles/empty` → the same Review/Edit form.
7. **Errors:** map `error.code` to the messages above, and show "Try again" when `retryable`.
8. **Types:** the demo's TypeScript API types live in `frontend/src/features/resume/api.ts`. A replacement client should derive or maintain its own types against `/openapi.json`, the API source of truth.
9. **CORS:** local Compose allows `http://localhost:5173`; configure any additional frontend origin through `CORS_ORIGINS`.

## 3.11 `GET /api/career-profiles`

Lists active career profiles that have at least one market-statistics row. The existing CV onboarding page uses this endpoint to populate the career selector before calculating a match. This endpoint requires the shared database.

**Response `200`**:
```json
{
  "careerProfiles": [
    {
      "careerProfileId": 12,
      "careerName": "AI Engineer",
      "profileName": "AI Engineer",
      "seniorityLevel": "mid"
    }
  ]
}
```

If the shared database is unavailable, it returns `503 CAREER_MATCH_UNAVAILABLE`.

## 3.12 `GET /api/profiles/{profileId}/career-match`

Compares a saved, user-confirmed profile with the latest available market-statistics window for one canonical career profile. This endpoint requires the shared database and does not use RAG; it calculates market coverage and level alignment deterministically from `app.user_skills` and `market.career_skill_stats`.

**Query**: `careerProfileId` (positive integer, required). **Header**: `X-Session-Id` (the anonymous session ID used when saving this profile, required). The API checks that the profile belongs to that anonymous session before returning skill/evidence data. The session ID is sent in a header rather than a URL query so it is less likely to be captured in URL logs. It selects one coherent market window for that career profile: the window with the latest `analysis_end_date`, then latest `analysis_start_date`. It does not mix rows from different windows.

**Response `200`** (illustrative):
```json
{
  "careerProfileId": 12,
  "marketWindow": { "startDate": "2026-01-01", "endDate": "2026-06-30" },
  "marketSample": { "totalJobs": 120, "lastUpdated": "2026-07-01T00:00:00Z" },
  "status": "estimated",
  "scores": {
    "marketSkillCoveragePct": 72.4,
    "proficiencyAlignmentPct": 66.67,
    "assessmentCoveragePct": 54.0
  },
  "skillSummary": {
    "considered": 10,
    "covered": 6,
    "missingFromProfile": 4,
    "notAssessed": 2,
    "marketDataInsufficient": 2,
    "excludedMarketSkills": 0
  },
  "skills": [
    {
      "skillId": 42,
      "skillName": "Python",
      "marketTargetLevel": "advanced",
      "targetLevelConfidence": 0.75,
      "levelObservationCount": 12,
      "demandCount": 80,
      "totalJobs": 120,
      "demandPercentage": 66.67,
      "weightedDemandScore": 0.8,
      "importanceTier": "core",
      "userHasSkill": true,
      "userProficiencyLevel": "intermediate",
      "proficiencyBasis": "inferred",
      "status": "proficiency_gap",
      "reasonCode": "USER_LEVEL_BELOW_MARKET_TARGET",
      "levelGap": 1,
      "levelFit": 0.6667,
      "evidence": [
        { "type": "project", "excerpt": "Built a data pipeline using Python...", "confidence": 0.9 }
      ]
    }
  ],
  "unmatchedUserSkills": [
    { "rawSkillName": "Unknown Tool", "matchStatus": "needs_review" }
  ],
  "warnings": [
    "Proficiency alignment covers only part of the market skill weight because some levels could not be assessed."
  ]
}
```

The percentages are derived scores, not the probability of being hired. `marketSkillCoveragePct` uses confirmed canonical skill presence weighted by `weighted_demand_score`. `proficiencyAlignmentPct` includes only confirmed skills with known user levels and sufficiently reliable market target levels. `assessmentCoveragePct` is the share of usable market weight included in proficiency alignment. User level `unknown` is `not_assessed`, never `beginner`. A null/zero market weight is excluded and disclosed rather than treated as zero demand. Small sample sizes, stale market statistics and incomplete level evidence produce an `estimated` status and warnings; provisional defaults are configurable with `MATCH_MIN_TOTAL_JOBS` (10), `MATCH_MAX_MARKET_AGE_DAYS` (180), `MATCH_MIN_LEVEL_OBSERVATIONS` (3), and `MATCH_MIN_TARGET_LEVEL_CONFIDENCE` (0.6). Each user's evidence is limited to at most three 320-character excerpts per skill, and unresolved catalog labels are returned separately in `unmatchedUserSkills`; neither is added to the score.

If no market stats are available, the endpoint returns `200` with `status: "insufficient_market_data"` and null scores rather than fabricated zero scores. If the profile is unknown it returns `404 PROFILE_NOT_FOUND`. If the backend is using local JSON profile storage or its database is unavailable it returns `503 CAREER_MATCH_UNAVAILABLE`.

Possible per-skill status values are `covered`, `proficiency_gap`, `missing_from_profile`, `not_assessed`, and `market_data_insufficient`. The reason codes are stable identifiers for UI localization. Career role resolution is not performed by this endpoint; callers must provide the selected `careerProfileId`.
