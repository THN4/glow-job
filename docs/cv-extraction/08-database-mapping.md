# 8. Database mapping (CV extraction ↔ the team's PostgreSQL design)

Source of truth for the database: [docs/db/glow_job_database_architecture.md](../db/glow_job_database_architecture.md) and [docs/schemas/app-schema.dbml](../schemas/app-schema.dbml) (from the `develop` branch). This page maps what CV extraction produces onto those `app.*` tables and lists the decisions that need the backend engineer.

Project structure (from `develop`, [docs/glow_job_project_structure.md](../glow_job_project_structure.md)): the FastAPI app lives in `backend/app/` (`api/`, `models/`, `schemas/`, `services/`, `repositories/`, `db/`, `integrations/`) and belongs to the **backend engineer**. "Resume upload, resume extraction integration, profile ingestion" are listed under backend. Our `app/cv_extraction/` package is the extraction engine that backend code calls.

## 8.1 The flow in the DB design

```text
CV Upload → S3 → app.resumes → LLM extraction → app.resume_extractions.extracted_json
   → Auto-fill UI → user edits / confirms → canonical user data
        (app.user_profiles, user_educations, user_experiences, user_skills, user_skill_evidence)
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
| Derived: current job, years of experience, education level, field of study | `user_profiles.current_job_title`, `years_experience`, `education_level`, `field_of_study` | Computed in a small step from the confirmed profile (current job = experience with `isCurrent`; years = summed work durations; level = highest degree). `current_status` (student / employed / career_switcher) comes from onboarding step 4 ("Current situation"), not from the CV |
| `education[]` | `app.user_educations` | `institution`→`institution_name`, `degree`, `fieldOfStudy`→`field_of_study`, dates (see 8.3), `gpa`→`description`, `source='resume'`, `source_resume_id`, `extraction_confidence` (8.3), `user_confirmed=true` after the user confirms |
| `experience[]` | `app.user_experiences` | `experience_type` = `internship` if `employmentType == "internship"`, else `work`. `title`, `organization`, `description` (+ `highlights` appended), dates. `location` and `employmentType` are not stored (kept in `extracted_json`) |
| `projects[]` | `app.user_experiences` with `experience_type='project'` | `title` ← project `name`, `description`, dates |
| `certifications[]` (competitions, workshops, awards, activities) | `app.user_experiences` | `competition`→`competition`, `workshop`→`course`, `certification`→`course`, `award` / `activity`→`other`. `title` ← `name`, `organization` ← `issuer`, `detail` ("Finalist") appended to `description`. **There is no certification table: see decision D3** |
| `technicalSkills[]` + `tools[]` (+ `technologies` of each experience/project) | `app.user_skills` | Needs `skill_id` (see D2). `source='resume'`, `confidence`, `proficiency_level='unknown'` (we don't extract levels), `user_confirmed` |
| Where a skill was found (an experience's / project's `technologies`) | `app.user_skill_evidence` | `evidence_type='experience'`, `experience_id`, `resume_id`, `evidence_text` (the item's title/description), `confidence` |
| `softSkills[]`, `languages[]`, `links[]`, `personal.headline` / `phone`, `warnings` | **no table**: kept only in `extracted_json` | Email belongs to `app.users` (auth), not to the CV |

## 8.3 Value conversions

| Our value | DB value |
|---|---|
| `"2020"` / `"2023-06"` (strings) | `date`: first day of the period (`2020-01-01`, `2023-06-01`). Precision (year only / month) is lost, so keep the original strings in `extracted_json` |
| `isCurrent: true`, `endDate: null` | `end_date = NULL` |
| `confidence` `high` / `medium` / `low` | `extraction_confidence` / `confidence` `numeric(4,3)`: proposed **0.900 / 0.600 / 0.300** (to agree with the team) |
| `needsReview` | not stored: the user has confirmed everything on save, so `user_confirmed = true` |
| Our IDs (`upl_<uuid>`, `job_<uuid>`, `edu_ab12`) | DB `bigint` IDs (`resume_id`, `extraction_id`, ...). The API should return the DB IDs |

## 8.4 Mismatches and decisions needed (with the backend engineer)

| # | Issue | Options | Suggested |
|---|---|---|---|
| **D1** | **Resume file retention.** The DB stores the file in S3 (`app.resumes.storage_key`, `is_current`). Our design deletes the file right after extraction (privacy requirement 7.1). | (a) keep the file in a private S3 bucket (needs user consent text, lifecycle/delete on request); (b) delete after extraction and make `storage_key` nullable | Decide as a team. (a) matches the DB and lets the user re-run extraction; (b) is more private. Our code supports both: deletion happens in one place (`pipeline.py` `finally`) |
| **D2** | **Skill IDs.** `user_skills.skill_id` points to `core.skills` (canonical, with `core.skill_aliases`). Our `skill_aliases.py` is a small stand-in. Skills not in `core.skills` have no ID. | (a) the DB is the source of truth: look names up in `core.skills` + `core.skill_aliases`, and keep unmatched ones only in `extracted_json`; (b) let the Data/RAG engineer add unmatched skills to `core.skills` | Use (a) now (replace our alias dict with a DB lookup behind the same function), and report unmatched skills to the Data/RAG engineer |
| **D3** | **Certifications / awards / languages / soft skills have no table.** | (a) store certifications as `user_experiences` (mapping above) and keep the rest only in `extracted_json`; (b) add `app.user_certifications` / `app.user_languages` | (a) for the MVP. Ask whether the roadmap agent needs certifications or languages |
| **D4** | **NOT NULL columns we may not fill.** `user_experiences.title` and `.experience_type` are `NOT NULL`; our `title` can be `null`. | Reject the save for items without a title (the review screen already asks for them), or fall back to `organization` | Validate on `PUT /profile`: title required for experiences |
| **D5** | **API shape.** The project doc plans `POST /resumes`, `POST /resumes/{id}/extract`, `GET /profile`, `PATCH /profile`. Ours: `POST /cv/uploads` (+ file upload), `POST /cv/extractions`, `GET /cv/extractions/{id}`, `PUT /profiles`. | Align ours to theirs: `POST /resumes` = create `app.resumes` + return the upload target; `POST /resumes/{id}/extract` = start an extraction (creates `app.resume_extractions`); poll `GET /resumes/{id}/extractions/{extraction_id}`; `PATCH /profile` = save the confirmed data into the canonical tables | Rename routes when merging (the router, schemas and error format stay the same) |
| **D6** | **Users / auth.** Everything is keyed by `user_id` (`app.users`). We use a placeholder `sessionId`. | Take `user_id` from the auth dependency of the backend app | Backend engineer's auth, injected into the router as a dependency |
| **D7** | **Job state is in memory** (1 h TTL) in local mode; the DB design makes `app.resume_extractions` the durable record (and polling reads from it). | Replace `JobsRepo` with a DB repository | Natural fit: the `Job` fields map 1:1 to `resume_extractions` |

## 8.5 How the code is meant to plug in

The extraction engine stays database-free. The backend engineer adds the persistence around it by implementing the storage classes in `app/cv_extraction/storage.py` against PostgreSQL / S3 (the class names and methods are already the seam):

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
