# 4. API Specification

Base URL: `http://localhost:8787` in local mode (now), or the API Gateway URL printed by `cdk deploy` in AWS mode (later). **The API is identical in both modes**, and only the upload target differs (§4.2). All paths are prefixed with `/api`. All JSON uses `camelCase`. Types refer to [03-data-schema.md](03-data-schema.md).

## 4.1 The flow

```
1. POST /api/cv/uploads            → where and how to upload the file
2. upload the file to upload.url   → local API (local mode) or S3 (AWS mode)
3. POST /api/cv/extractions        → 202 { jobId }
4. GET  /api/cv/extractions/{id}   → poll until status is succeeded or failed
5. PUT  /api/profiles              → save what the user confirmed
```

## 4.2 `POST /api/cv/uploads`

Asks for permission to upload one file.

**Request**
```json
{ "fileName": "my-cv.pdf", "contentType": "application/pdf", "size": 482113 }
```

**Response `201`**, local mode:
```json
{
  "uploadId": "upl_7b1e…",
  "upload": { "method": "PUT", "url": "http://localhost:8787/api/cv/uploads/upl_7b1e…/file", "headers": { "Content-Type": "application/pdf" } },
  "expiresInSeconds": 300
}
```

**Response `201`**, AWS mode (S3 presigned POST):
```json
{
  "uploadId": "upl_7b1e…",
  "upload": {
    "method": "POST",
    "url": "https://glow-job-uploads-xxxx.s3.amazonaws.com/",
    "fields": { "key": "uploads/upl_7b1e…", "Content-Type": "application/pdf", "policy": "…", "x-amz-signature": "…", "…": "…" }
  },
  "expiresInSeconds": 300
}
```

The client must handle both shapes. This is one small helper:
- `method: "PUT"` → send the raw file as the body with `upload.headers`.
- `method: "POST"` → send `multipart/form-data` with every entry of `upload.fields` **followed by** the `file` field (S3 requires `file` last). S3 rejects files over 10 MB or with a different content type.

```bash
# example with curl (fields abbreviated)
curl -X POST "$URL" -F key=uploads/upl_7b1e… -F Content-Type=application/pdf -F policy=… -F x-amz-signature=… … -F file=@my-cv.pdf
```

## 4.3 `POST /api/cv/extractions`

Starts the analysis of an uploaded file.

**Request**: `{ "uploadId": "upl_7b1e…" }`

**Response `202`**: `{ "jobId": "job_93c2…", "status": "queued" }`

## 4.4 `GET /api/cv/extractions/{jobId}`

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

## 4.5 `GET /api/profiles/empty`

Returns an empty `CvProfile` (all lists `[]`, scalars `null`), for **"Continue without CV"**.

## 4.6 `PUT /api/profiles`

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
- When DB settings and migration `009` are present, the confirmed profile is saved to `app.user_profiles` and normalized child tables. Without DB settings, local mode stores profiles in `.data/profiles.json`.

**Response `200`**: `{ "profileId": "prf_51aa…", "updatedAt": "2026-10-05T10:00:00Z" }`

## 4.7 `GET /api/profiles/{profileId}`

Returns `{ "profileId", "updatedAt", "profile": CvProfile }`, or `404 PROFILE_NOT_FOUND`.

## 4.8 `GET /api/health`

Returns `{ "status": "ok" }`.

## 4.9 Errors

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
| 429 | `RATE_LIMITED` | API Gateway throttling | "Too many requests. Please wait a moment." (`retryable: true`) |
| 429 | `DAILY_LIMIT_REACHED` | The daily extraction cap (credit protection) is used up | "We've reached today's limit. Please try again tomorrow or fill in your profile manually." (`retryable: false`) |
| 503 | `SKILL_CATALOG_UNAVAILABLE` | Catalog access is configured but the DB is unreachable, empty, or invalid | Retry later; do not treat skills as unmatched |
| 503 | `PROFILE_STORE_UNAVAILABLE` | The configured DB could not save or load the confirmed profile | Retry later; the profile was not saved |
| — (job) | `TOO_MANY_PAGES` | PDF > 10 pages | "Your CV is longer than 10 pages." |
| — (job) | `UNREADABLE_DOCUMENT` | Blank, encrypted or corrupt file | "We couldn't read this file. Try a clearer scan or a PDF." |
| — (job) | `NOT_A_CV` | The model judged it is not a CV/résumé | "This doesn't look like a CV. Please check the file." |
| — (job) | `EXTRACTION_DECLINED` | Provider declines the extraction | "We couldn't process this file." |
| — (job) | `EXTRACTION_FAILED` | Provider error after retries, or invalid output | "Something went wrong. Please try again." (`retryable: true`) |
| — (job) | `EXTRACTION_TIMEOUT` | Worker exceeded the configured extraction timeout | Same as above (`retryable: true`) |

## 4.10 Frontend integration

1. **Upload step:** implemented at `/onboarding/cv`: call `uploads` → upload the file (PUT or POST, see §4.2) → call `extractions`.
2. **Analyzing screen:** poll the job and tick off rows as `stage` advances. Show "This usually takes less than a minute".
3. **Review step:** render one card per section of `result.profile`. For each technical skill/tool, show the matched canonical catalog name when `catalogMatch.status === "matched"`; retain the extracted label as the user's wording. Show an unmatched state when status is `unmatched`, and a neutral “catalog not checked” state when `catalogMatch` is `null`. Unmatched catalog entries are flagged `needsReview` for the user's attention. Use `meta.reviewCount` and `meta.warnings` for a summary banner.
4. **Edit:** keep the profile in local state (e.g. React Hook Form). Set `source: "user"` on any item the user edits or adds.
5. **Continue:** `PUT /api/profiles`, store the `profileId`, then continue onboarding.
6. **Continue without CV:** `GET /api/profiles/empty` → the same Review/Edit form.
7. **Errors:** map `error.code` to the messages above, and show "Try again" when `retryable`.
8. **Types:** generate them from the backend's OpenAPI document (`/openapi.json`, e.g. with `openapi-typescript`) and never redefine them by hand.
9. **CORS:** local Compose allows `http://localhost:5173`; add the deployed frontend URL to `CORS_ORIGINS` and to the S3 bucket CORS when deployment is implemented.
