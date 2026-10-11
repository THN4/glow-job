# 8. Database mapping (CV extraction ↔ the team's PostgreSQL design)

Source of truth for the database design: [the consolidated DBML](../schemas/glow-job.dbml) and its [application-domain view](../schemas/app-schema.dbml). This page maps what CV extraction produces onto those `app.*` tables and lists implementation decisions for the backend engineer.

The FastAPI app lives in `backend/app/`. Its API composition and Resume routes/job orchestration live in `app/api/` and `app/features/resume/`; reusable Resume parsing, extraction contracts, schemas, and post-processing live in `data-pipeline/src/resume/`. The backend owns upload handling and profile persistence.

## 8.1 The flow in the DB design

```text
CV Upload → S3 → app.resumes → LLM extraction → app.resume_extractions.extracted_json
   → Auto-fill UI → user edits / confirms → canonical user data
        (app.user_profiles, user_educations, user_experiences, user_skills, user_skill_evidence, user_certifications)
```

Our pipeline is exactly the "LLM extraction → extracted_json" step, and our `PUT /profiles` is the "user confirms → canonical data" step.

## 8.2 What maps where

| Our output | DB table / column | Notes |
|---|---|---|
| Upload (`fileName`, `contentType`, `size`) | `app.resumes` (`file_name`, `mime_type`, `file_size_bytes`, `storage_key`, `is_current`, `uploaded_at`) | **See decision D1** (we delete the file after processing, the DB expects it in S3) |
| Extraction job (our in-memory `Job`) | `app.resume_extractions` | The job becomes the durable row. `queued→pending`, `processing→processing`, `succeeded→completed`, `failed→failed` (`error_message` ← error code + message) |
| `meta.model` | `model_name`; provider (`ollama` / `openai-compatible` / `bedrock`) → `model_provider` | |
| Extracted text (text inputs only) | `extracted_text` | `NULL` for scans/photos (images are not text) |
| The whole `profile` JSON (camelCase, with confidence + `needsReview`) | `extracted_json` (jsonb) | Stored **as extracted, before the user edits**. Keeps everything the tables below can't hold |
| User saves without / with changes / discards | `review_status` = `confirmed` / `edited` / `rejected` (`pending` until then) | Compare the saved profile with `extracted_json` to choose confirmed vs edited |
| Each extraction run (model, status, times, error; no CV content) | `system.ai_runs` (`operation_type='resume_extraction'`) | Fits our metadata-only logging rule |
| `personal.fullName`, `summary`, `location` | `app.user_profiles` (`display_name`, `background_summary`, `location`) | |
| Derived: current job, years of experience, education level, field of study | `user_profiles.current_job_title`, `years_experience`, `education_level`, `field_of_study` | Computed in a small step from the confirmed profile (current job = current experience; years = summed work durations; level = highest degree). `current_status` comes from onboarding step 4 and uses the UI choices: student / employed full-time / employed part-time / between opportunities / other |
| `education[]` | `app.user_educations` | `institution`→`institution_name`, `degree`, `fieldOfStudy`→`field_of_study`, dates plus date precision, `gpa`→`description`, `source='resume'`, `source_resume_id`, `extraction_confidence`, `user_confirmed` after confirmation |
| `experience[]` | `app.user_experiences` | `experience_type` = `internship` if applicable, otherwise `work`. Stores title, organization, role, location, description, highlights, dates and their precision, current status, source, and confirmation |
| `projects[]` | `app.user_experiences` with `experience_type='project'` | Project name, role, URL, description, highlights, dates, and technology evidence |
| `certifications[]` (competitions, workshops, awards, activities) | `app.user_certifications` | `kind`, name, issuer, award date and precision/details, source, confidence, and user confirmation |
| `technicalSkills[]` + `tools[]` (+ `technologies` of each experience/project) | `app.user_skills` | Always stores the observed `raw_skill_name`; `skill_id` is nullable until matched to `core.skills`. Unmatched skills remain attached to the user's profile and do not create catalog skills automatically |
| Where a skill was found (an experience's / project's `technologies`) | `app.user_skill_evidence` | `user_skill_id`, `experience_id`, `resume_id`, evidence type/text, and confidence |
| Selected career, readiness, weekly time, learning preference, optional note | `app.user_career_goals` | Store the selected role title and catalog IDs when matched, readiness timeframe, weekly availability band, learning preference, and optional context (max 500 characters). Map an unmatched custom role before market comparison/roadmap generation |
| `softSkills[]`, `languages[]`, `links[]`, `personal.headline` / `phone`, `warnings` | **no table**: kept only in `extracted_json` | Email belongs to `app.users` (auth), not to the CV |

## 8.3 Value conversions

| Our value | DB value |
|---|---|
| `"2020"` / `"2023-06"` (strings) | `date`: first day of the period (`2020-01-01`, `2023-06-01`) plus `date_precision` (`year` / `month`); retain source strings in `extracted_json` too |
| `isCurrent: true`, `endDate: null` | `is_current = true`, `end_date = NULL` for an experience |
| `confidence` `high` / `medium` / `low` | `extraction_confidence` / `confidence` `numeric(4,3)`: proposed **0.900 / 0.600 / 0.300** (to agree with the team) |
| `needsReview` | not stored: the user has confirmed everything on save, so `user_confirmed = true` |
| Our IDs (`upl_<uuid>`, `job_<uuid>`, `edu_ab12`) | DB `bigint` IDs (`resume_id`, `extraction_id`, ...). The API should return the DB IDs |

## 8.4 Mismatches and decisions needed (with the backend engineer)

| # | Issue | Options | Suggested |
|---|---|---|---|
| **D1** | **Resume file retention.** The DB stores the file in S3 (`app.resumes.storage_key`, `is_current`). Our design deletes the file right after extraction (privacy requirement 7.1). | (a) keep the file in a private S3 bucket (needs user consent text, lifecycle/delete on request); (b) delete after extraction and make `storage_key` nullable | Decide as a team. (a) matches the DB and lets the user re-run extraction; (b) is more private. Our code supports both: deletion happens in one place (`pipeline.py` `finally`) |
| **D2** | **Skill catalog matching.** `user_skills.skill_id` points to `core.skills` when a match exists; the raw label is retained regardless. | Match through the canonical skill catalog and aliases; store `match_status` as matched, needs review, or unmatched. Do not create a catalog entry as a side effect of resume ingestion. | Persist unmatched labels on the user's skill row and let a separate review/catalog workflow decide whether to map or create a canonical skill |
| **D3** | **Languages and soft skills have no dedicated tables.** Certifications, awards, competitions, workshops, and activities now have `app.user_certifications`. | Keep language and soft-skill details in `extracted_json` until product requirements call for first-class tables. | No additional table needed for the UI shown |
| **D4** | **NOT NULL columns we may not fill.** `user_experiences.title` and `.experience_type` are `NOT NULL`; our `title` can be `null`. | Reject the save for items without a title (the review screen already asks for them), or fall back to `organization` | Validate on `PUT /profile`: title required for experiences |
| **D5** | **API shape.** The project doc plans `POST /resumes`, `POST /resumes/{id}/extract`, `GET /profile`, `PATCH /profile`. Ours: `POST /cv/uploads` (+ file upload), `POST /cv/extractions`, `GET /cv/extractions/{id}`, `PUT /profiles`. | Align ours to theirs: `POST /resumes` = create `app.resumes` + return the upload target; `POST /resumes/{id}/extract` = start an extraction (creates `app.resume_extractions`); poll `GET /resumes/{id}/extractions/{extraction_id}`; `PATCH /profile` = save the confirmed data into the canonical tables | Rename routes when merging (the router, schemas and error format stay the same) |
| **D6** | **Users / auth.** Everything is keyed by `user_id` (`app.users`). We use a placeholder `sessionId`. | Take `user_id` from the auth dependency of the backend app | Backend engineer's auth, injected into the router as a dependency |
| **D7** | **Job state is in memory** (1 h TTL) in local mode; the DB design makes `app.resume_extractions` the durable record (and polling reads from it). | Replace `JobsRepo` with a DB repository | Natural fit: the `Job` fields map 1:1 to `resume_extractions` |

## 8.5 How the code is meant to plug in

The reusable extraction engine stays database-free. The backend owns persistence through its storage/service adapters in `backend/app/features/resume/`:

| Our class | Becomes |
|---|---|
| `LocalUploadStore` | S3 presigned upload + a row in `app.resumes` |
| `JobsRepo` | reads / writes `app.resume_extractions` |
| `FileProfilesRepo` | the `confirm` step writing `user_educations`, `user_experiences`, `user_skills`, `user_skill_evidence` (+ `user_profiles`) |
| `CacheRepo` / `UsageCounter` | a table or Redis (optional: they only save model calls) |
| `JobQueue` | a worker (background task / queue) |

The pure mapping from a confirmed `CvProfile` to those rows (dates, confidence, experience types, skill lookup, evidence links) is a good small, testable function. It can be written without a database connection and tested with plain dicts. It is not written yet because it depends on decisions D1-D4.

## 8.6 Related: shared contracts

`shared/contracts/` and `shared/mock/` (from `develop`) are meant for cross-team JSON contracts (`user_context.schema.json`, `agent_input.schema.json`, ...). The confirmed profile above is the natural source for the agent's **user context**. Before the AI engineer depends on it, put the agreed shape in `shared/contracts/user/user_context.schema.json` and a sample in `shared/mock/user_context.json` (the CV extraction `CvProfile` JSON is a ready-made starting point; the OpenAPI document of the backend also describes it).
