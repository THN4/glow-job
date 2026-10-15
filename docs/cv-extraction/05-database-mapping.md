# Database Mapping (CV Extraction and PostgreSQL)

Source of truth for the database design: [the consolidated DBML](../schemas/glow-job.dbml) and its [application-domain view](../schemas/app-schema.dbml). This page maps what CV extraction produces onto those `app.*` tables and lists implementation decisions for the backend engineer.

The FastAPI app lives in `backend/app/`. Its API composition and Resume routes/job orchestration live in `app/api/` and `app/features/resume/`; reusable Resume parsing, extraction contracts, schemas, and post-processing live in `data-pipeline/src/resume/`. The backend owns upload handling and profile persistence.

## 5.1 The flow in the DB design

```text
CV Upload → local temporary storage → LLM extraction (in-memory job)
   → read-only match against core.skills + core.skill_aliases
   → Auto-fill UI (canonical match or unresolved status) → user edits / confirms
   → re-match → canonical user data
        (app.user_profiles, user_educations, user_experiences, user_skills, user_skill_evidence, user_certifications)
```

The current local flow runs extraction jobs in memory and deletes the uploaded file after processing. `PUT /profiles` persists the user-confirmed profile and normalized facts; it does not persist the source CV or the pre-review extraction job.

## 5.2 What maps where

| Our output | DB table / column | Notes |
|---|---|---|
| Upload and extraction job | Not persisted by the current local flow | File is temporary and deleted after processing; job state stays in memory. No `app.resumes` or `app.resume_extractions` row is created. |
| Extraction metadata and pre-review model output | Not persisted in the current local flow | Job state and extraction result expire from memory; durable extraction history is future work. |
| `personal.fullName`, `summary`, `location`, and full confirmed profile | `app.user_profiles` (`display_name`, `background_summary`, `location`, `profile_data`) | `profile_data` retains fields without dedicated columns, including soft skills, languages, links, headline, phone, and UI metadata |
| Derived: current job, years of experience, education level, field of study | `user_profiles.current_job_title`, `years_experience`, `education_level`, `field_of_study` | Computed in a small step from the confirmed profile (current job = current experience; years = summed work durations; level = highest degree). `current_status` is selected during onboarding using one of the supported values: student / employed full-time / employed part-time / between opportunities / other |
| `education[]` | `app.user_educations` | `institution`→`institution_name`, `degree`, `fieldOfStudy`→`field_of_study`, dates plus date precision, `gpa`→`description`, `source='resume'`, `source_resume_id`, `extraction_confidence`, `user_confirmed` after confirmation |
| `experience[]` | `app.user_experiences` | `experience_type` = `internship` if applicable, otherwise `work`. Stores title, organization, role, location, description, highlights, dates and their precision, current status, source, and confirmation |
| `projects[]` | `app.user_experiences` with `experience_type='project'` | Project name, role, URL, description, highlights, dates, and technology evidence |
| `certifications[]` (competitions, workshops, awards, activities) | `app.user_certifications` | `kind`, name, issuer, award date and precision/details, source, confidence, and user confirmation |
| `technicalSkills[]` + `tools[]` (+ `technologies` of each experience/project) | `app.user_skills` | Always stores the observed `raw_skill_name`; backend compares it with canonical names and aliases in the same catalog used by Market. `skill_id` is set for a deterministic match, otherwise null with `unmatched` or `needs_review`. No catalog row is created automatically |
| Where a skill was found (an experience's / project's `technologies`) | `app.user_skill_evidence` | `user_skill_id`, `experience_id`, `resume_id`, evidence type/text, and confidence |
| Selected career, readiness, weekly time, learning preference, optional note | `app.user_career_goals` | Store the selected role title and catalog IDs when matched, readiness timeframe, weekly availability band, learning preference, and optional context (max 500 characters). Map an unmatched custom role before market comparison/roadmap generation |
| `softSkills[]`, `languages[]`, `links[]`, `personal.headline` / `phone`, `warnings` | `app.user_profiles.profile_data` | The confirmed full profile JSON preserves fields without dedicated relational columns. CV email is retained there and is not used as an account email. |

## 5.3 Value conversions

| Our value | DB value |
|---|---|
| `"2020"` / `"2023-06"` (strings) | `date`: first day of the period (`2020-01-01`, `2023-06-01`) plus `date_precision` (`year` / `month`); the complete original values remain in `user_profiles.profile_data` |
| `isCurrent: true`, `endDate: null` | `is_current = true`, `end_date = NULL` for an experience |
| `confidence` `high` / `medium` / `low` | `extraction_confidence` / `confidence` `numeric(4,3)`: **0.900 / 0.600 / 0.300** |
| `needsReview` | not stored: the user has confirmed everything on save, so `user_confirmed = true` |
| Our IDs (`upl_<uuid>`, `job_<uuid>`, `edu_ab12`) | DB `bigint` IDs for normalized rows; opaque `profile_id` for the saved profile | Upload and job IDs remain temporary; the API returns `profileId` for later profile reads/updates |

## 5.4 Current persistence boundaries

- The uploaded CV and extraction job are temporary. This flow does not create
  `app.resumes` or `app.resume_extractions` rows.
- The confirmed profile is saved to `app.user_profiles` and normalized child
  tables when the backend has database settings. Direct local runs can fall
  back to `.data/profiles.json`.
- Incomplete experience/project entries remain in `profile_data`; entries
  without the required title/name are omitted from `app.user_experiences`.
- `technicalSkills`, `tools`, and experience/project `technologies` resolve
  against the shared catalog. Duplicate canonical skills are stored once, with
  project/work evidence attached in `app.user_skill_evidence`. Unmatched labels
  are retained without a catalog `skill_id`.
- Career matching reads confirmed, catalog-matched user skills against the
  selected career profile's latest Market window. It does not use RAG or a
  stored skill-dependency graph.

## 5.5 Persistence adapters

The reusable extraction engine stays database-free. The backend owns persistence through its storage/service adapters in `backend/app/features/resume/`:

| Adapter | Current behavior |
|---|---|
| `LocalUploadStore` | Accepts temporary local uploads and removes them after extraction. |
| `JobsRepo` | Keeps extraction-job state in memory for polling. |
| `DatabaseProfilesRepo` | Writes the confirmed profile and normalized child rows in one transaction. |
| `FileProfilesRepo` | Stores profiles in JSON when direct local runs lack DB credentials. |
| `CacheRepo` / `UsageCounter` | Keeps extraction cache and usage counts in memory. |
| `JobQueue` | Runs extraction jobs in the backend process. |

The backend maps a confirmed `CvProfile` to those rows in a single database transaction. The complete camelCase profile is retained in `app.user_profiles.profile_data`, so fields without a dedicated relational table are not discarded. Resume binaries are deleted after extraction; `source_resume_id` therefore remains null and this flow does not populate `app.resumes` or `app.resume_extractions`. Skill catalog matching is recomputed before save, and unmatched labels are retained without creating catalog rows.
