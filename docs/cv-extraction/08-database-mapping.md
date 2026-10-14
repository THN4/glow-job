# 8. Database mapping (CV extraction ↔ the team's PostgreSQL design)

Source of truth for the database design: [the consolidated DBML](../schemas/glow-job.dbml) and its [application-domain view](../schemas/app-schema.dbml). This page maps what CV extraction produces onto those `app.*` tables and lists implementation decisions for the backend engineer.

The FastAPI app lives in `backend/app/`. Its API composition and Resume routes/job orchestration live in `app/api/` and `app/features/resume/`; reusable Resume parsing, extraction contracts, schemas, and post-processing live in `data-pipeline/src/resume/`. The backend owns upload handling and profile persistence.

## 8.1 The flow in the DB design

```text
CV Upload → local temporary storage → LLM extraction (in-memory job)
   → read-only match against core.skills + core.skill_aliases
   → Auto-fill UI (canonical match or unresolved status) → user edits / confirms
   → re-match → canonical user data
        (app.user_profiles, user_educations, user_experiences, user_skills, user_skill_evidence, user_certifications)
```

The current local flow runs extraction jobs in memory and deletes the uploaded file after processing. `PUT /profiles` persists the user-confirmed profile and normalized facts; it does not persist the source CV or the pre-review extraction job.

## 8.2 What maps where

| Our output | DB table / column | Notes |
|---|---|---|
| Upload and extraction job | Not persisted by the current local flow | File is temporary and deleted after processing; job state stays in memory. No `app.resumes` or `app.resume_extractions` row is created. |
| Extraction metadata and pre-review model output | Not persisted in the current local flow | Job state and extraction result expire from memory; durable extraction history is future work. |
| `personal.fullName`, `summary`, `location`, and full confirmed profile | `app.user_profiles` (`display_name`, `background_summary`, `location`, `profile_data`) | `profile_data` retains fields without dedicated columns, including soft skills, languages, links, headline, phone, and UI metadata |
| Derived: current job, years of experience, education level, field of study | `user_profiles.current_job_title`, `years_experience`, `education_level`, `field_of_study` | Computed in a small step from the confirmed profile (current job = current experience; years = summed work durations; level = highest degree). `current_status` comes from onboarding step 4 and uses the UI choices: student / employed full-time / employed part-time / between opportunities / other |
| `education[]` | `app.user_educations` | `institution`→`institution_name`, `degree`, `fieldOfStudy`→`field_of_study`, dates plus date precision, `gpa`→`description`, `source='resume'`, `source_resume_id`, `extraction_confidence`, `user_confirmed` after confirmation |
| `experience[]` | `app.user_experiences` | `experience_type` = `internship` if applicable, otherwise `work`. Stores title, organization, role, location, description, highlights, dates and their precision, current status, source, and confirmation |
| `projects[]` | `app.user_experiences` with `experience_type='project'` | Project name, role, URL, description, highlights, dates, and technology evidence |
| `certifications[]` (competitions, workshops, awards, activities) | `app.user_certifications` | `kind`, name, issuer, award date and precision/details, source, confidence, and user confirmation |
| `technicalSkills[]` + `tools[]` (+ `technologies` of each experience/project) | `app.user_skills` | Always stores the observed `raw_skill_name`; backend compares it with canonical names and aliases in the same catalog used by Market. `skill_id` is set for a deterministic match, otherwise null with `unmatched` or `needs_review`. No catalog row is created automatically |
| Where a skill was found (an experience's / project's `technologies`) | `app.user_skill_evidence` | `user_skill_id`, `experience_id`, `resume_id`, evidence type/text, and confidence |
| Selected career, readiness, weekly time, learning preference, optional note | `app.user_career_goals` | Store the selected role title and catalog IDs when matched, readiness timeframe, weekly availability band, learning preference, and optional context (max 500 characters). Map an unmatched custom role before market comparison/roadmap generation |
| `softSkills[]`, `languages[]`, `links[]`, `personal.headline` / `phone`, `warnings` | `app.user_profiles.profile_data` | The confirmed full profile JSON preserves fields without dedicated relational columns. CV email is retained there and is not used as an account email. |

## 8.3 Value conversions

| Our value | DB value |
|---|---|
| `"2020"` / `"2023-06"` (strings) | `date`: first day of the period (`2020-01-01`, `2023-06-01`) plus `date_precision` (`year` / `month`); the complete original values remain in `user_profiles.profile_data` |
| `isCurrent: true`, `endDate: null` | `is_current = true`, `end_date = NULL` for an experience |
| `confidence` `high` / `medium` / `low` | `extraction_confidence` / `confidence` `numeric(4,3)`: proposed **0.900 / 0.600 / 0.300** (to agree with the team) |
| `needsReview` | not stored: the user has confirmed everything on save, so `user_confirmed = true` |
| Our IDs (`upl_<uuid>`, `job_<uuid>`, `edu_ab12`) | DB `bigint` IDs for normalized rows; opaque `profile_id` for the saved profile | Upload and job IDs remain temporary; the API returns `profileId` for later profile reads/updates |

## 8.4 Mismatches and decisions needed (with the backend engineer)

| # | Issue | Options | Suggested |
|---|---|---|---|
| **D1** | **Resume file retention.** The current local flow deletes the CV after extraction. | Keep it temporary; do not create an `app.resumes` row until durable private file storage and deletion policy are implemented | The confirmed profile is saved, but the original CV and extraction job are not. |
| **D2** | **Skill catalog matching.** `user_skills.skill_id` points to `core.skills` when a match exists; the raw label is retained regardless. | The backend reads `core.skills` and `core.skill_aliases`, applies the same deterministic canonical/alias matching rules as Market before showing Review Profile, then reruns matching after edits and before persistence. Store `match_status` as matched, needs review, or unmatched. Do not create a catalog entry as a side effect of resume ingestion. | Share or factor the pure matching rules used by Market; keep catalog reads in a backend adapter. Persist unmatched labels on the user's skill row and let the separate skill-catalog review workflow decide whether to map or create a canonical skill |
| **D3** | **Languages and soft skills have no dedicated tables.** Certifications, awards, competitions, workshops, and activities have `app.user_certifications`. | Keep language and soft-skill details in the full confirmed `profile_data` JSON until product requirements call for first-class tables. | No additional table needed for the current UI |
| **D4** | **NOT NULL columns we may not fill.** `user_experiences.title` and `.experience_type` are `NOT NULL`; extracted titles can be null. | Preserve the full item in `profile_data`; omit only that incomplete item from the normalized experiences table | Avoid dropping CV content while respecting relational constraints |
| **D5** | **API shape.** The project doc plans `POST /resumes`, `POST /resumes/{id}/extract`, `GET /profile`, `PATCH /profile`. Current local routes use `/cv/uploads`, `/cv/extractions`, and `/profiles`. | Keep current API routes for this integration; decide route alignment when joining the product backend | No source-file or extraction-history row is written yet |
| **D6** | **Anonymous users.** Everything is keyed by `user_id` (`app.users`); there is no login dependency in the current app. | Migration `009` permits `email = NULL`; the backend upserts an `app.users` row with `auth_provider='anonymous'` and `auth_subject=sessionId` | The client must generate and retain a hard-to-guess UUID as `sessionId`; losing it means the anonymous profile cannot be recovered |
| **D7** | **Job state is in memory** (1 h TTL) in local mode; the DB design makes `app.resume_extractions` the durable record (and polling reads from it). | Replace `JobsRepo` with a DB repository | Natural fit: the `Job` fields map 1:1 to `resume_extractions` |

## 8.5 How the code is meant to plug in

The reusable extraction engine stays database-free. The backend owns persistence through its storage/service adapters in `backend/app/features/resume/`:

| Our class | Becomes |
|---|---|
| `LocalUploadStore` | temporary local upload; S3 and `app.resumes` are future work |
| `JobsRepo` | in-memory job state; durable `app.resume_extractions` is future work |
| `DatabaseProfilesRepo` | the confirm step writes `user_profiles.profile_data` plus normalized education, experience/project, skill/evidence, and certification rows in one transaction |
| `FileProfilesRepo` | fallback for direct local runs when DB credentials are not configured |
| `CacheRepo` / `UsageCounter` | a table or Redis (optional: they only save model calls) |
| `JobQueue` | a worker (background task / queue) |

The backend maps a confirmed `CvProfile` to those rows in a single database transaction. The complete camelCase profile is also retained in `app.user_profiles.profile_data`, so fields without a dedicated relational table are not discarded. Resume binaries are still deleted after extraction; `source_resume_id` therefore remains null and this local flow does not populate `app.resumes` or `app.resume_extractions`. Skill catalog matching is recomputed before save, and unmatched labels are retained without creating catalog rows.

## 8.6 Related: shared contracts

`shared/contracts/` and `shared/mock/` (from `develop`) are meant for cross-team JSON contracts (`user_context.schema.json`, `agent_input.schema.json`, ...). The confirmed profile above is the natural source for the agent's **user context**. Before the AI engineer depends on it, put the agreed shape in `shared/contracts/user/user_context.schema.json` and a sample in `shared/mock/user_context.json` (the CV extraction `CvProfile` JSON is a ready-made starting point; the OpenAPI document of the backend also describes it).
