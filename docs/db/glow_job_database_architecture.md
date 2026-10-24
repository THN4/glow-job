# Glow-Job Database Architecture

## 1. Purpose

This document describes the current Glow-Job database plan in two areas:

- **Market / Knowledge** - job market data, skill extraction, market baselines, RAG, and the skill knowledge graph.
- **App** - users, resumes, profiles, skills, career goals, roadmaps, progress, and product data.

For the MVP, use **one PostgreSQL database on Amazon RDS** with these logical schemas:

```text
core
market
knowledge
app
system
```

Ownership is divided as follows:

```text
Market/Data/RAG Service
→ owns core + market + knowledge

Application Service
→ owns app

Operations shared by these services
→ owns system
```

In the MVP, the canonical DBML defines cross-schema foreign keys for these IDs. If the services later use separate databases, the app will retain `skill_id`, `career_id`, `career_profile_id`, `job_id`, `company_id`, and `module_id` as external IDs without cross-database foreign keys.

---

# 2. High-Level Flow

```text
JSearch / Job Sources
        ↓
market.job_postings
        ↓
Skill Extraction
        ↓
market.job_skills
        ↓
Aggregation
        ↓
market.career_skill_stats
        │
        │
        ├──────────────┐
        │              │
        ▼              ▼
  Market Baseline   knowledge.*
                     │
                     ├── Skill Graph
                     ├── Learning Modules
                     └── RAG Context
        │              │
        └──────┬───────┘
               ▼
             Agent
               ▲
               │
      app.user_skills
      app.user_profiles
      app.user_progress
               │
               ▼
         app.roadmaps
```

---

# 3. CORE — Shared Canonical Data

The anonymous Resume onboarding flow uses `app.users` rows keyed by the client-generated `sessionId`. With database settings enabled, the backend stores upload metadata and durable extraction status/structured output in `app.resumes` and `app.resume_extractions`; CV bytes and extracted raw document text are deleted/not retained. After confirmation, the backend stores the reviewed profile in `app.user_profiles.profile_data` and normalized facts in related `app.*` tables. See [Resume database mapping](../cv-extraction/05-database-mapping.md) for field-level details.

## `core.companies`

Canonical company records normalize names from multiple sources.

| Column | Meaning |
|---|---|
| `company_id` | Primary key |
| `company_name` | Canonical company name |
| `normalized_name` | Name used for matching and deduplication |
| `company_website` | Website |
| `created_at` | Creation time |
| `updated_at` | Last update time |

Example:

```text
Agoda Co., Ltd.
AGODA
Agoda Company Pte Ltd
→ Agoda
```

## `core.careers`

Top-level careers such as Data Engineer and Data Analyst.

| Column | Meaning |
|---|---|
| `career_id` | Career ID |
| `slug` | Stable key, such as `data_engineer` |
| `career_name` | Career name |
| `description` | Description |
| `is_active` | Whether the career is active |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `core.career_profiles`

Separate careers by seniority.

```text
Data Engineer
├── Junior Data Engineer
├── General Data Engineer
└── Senior Data Engineer
```

| Column | Meaning |
|---|---|
| `career_profile_id` | Profile ID |
| `career_id` | Parent career |
| `slug` | Stable key |
| `profile_name` | Profile name |
| `seniority_level` | junior / mid / senior / general |
| `description` | Description |
| `is_active` | Whether the record is active |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `core.skills`

Shared skill master for the system, including Python, SQL, and Apache Airflow.

| Column | Meaning |
|---|---|
| `skill_id` | Canonical Skill ID |
| `skill_name` | Canonical name |
| `skill_category` | Programming / Database / Cloud / etc. |
| `description` | Description |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `core.skill_aliases`

Normalize skill names.

```text
Postgres → PostgreSQL
AWS Cloud → Amazon Web Services
```

| Column | Meaning |
|---|---|
| `alias_id` | Alias ID |
| `skill_id` | Canonical Skill |
| `alias` | Alternate skill name |
| `created_at` | Creation time |

---

# 4. MARKET — Job Market Intelligence

## `market.job_postings`

Store job postings after ingestion and cleaning.

| Column | Meaning |
|---|---|
| `job_id` | Internal Job ID |
| `provider_job_id` | Provider's job ID |
| `company_id` | Canonical company |
| `career_profile_id` | Career/Profile mapping |
| `job_title` | Original job title |
| `normalized_job_title` | Normalized job title |
| `job_description` | JD |
| `location` | Location raw |
| `city` | City |
| `state` | Province or state |
| `country` | Country code |
| `employment_type` | Full-time / Internship / etc. |
| `provider` | API provider, such as JSearch |
| `publisher` | Publisher, such as LinkedIn |
| `source_url` | Source URL |
| `posted_at` | Posting date |
| `collected_at` | Collection time |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `market.job_search_matches`

Records the search query and ingestion run that found a deduplicated posting. One job can match several queries or runs.

| Column | Meaning |
|---|---|
| `job_id` | Deduplicated posting |
| `run_id` | Ingestion run |
| `career_profile_id` | Career profile used by the search |
| `search_query` | Query that returned the posting |
| `collected_at` | Collection time |

## `market.job_skills`

Skill extraction result for a job posting.

| Column | Meaning |
|---|---|
| `job_id` | Job |
| `skill_id` | Canonical Skill |
| `raw_skill_name` | Skill name before normalization |
| `requirement_type` | required / preferred / optional / unknown |
| `proficiency_level` | beginner / intermediate / advanced / expert / unknown |
| `importance_weight` | Importance of the skill to this job |
| `skill_confidence` | Confidence in skill identification |
| `requirement_confidence` | Confidence in requirement type |
| `proficiency_confidence` | Confidence in proficiency level |
| `overall_confidence` | Combined confidence |
| `evidence_text` | Supporting text from the job description |
| `extraction_method` | llm / rule / hybrid / manual |
| `created_at` | Creation time |

Agreed formula:

```text
importance_weight =
0.7 × requirement_score +
0.3 × proficiency_score
```

And:

```text
overall_confidence =
0.40 × skill_confidence +
0.35 × requirement_confidence +
0.25 × proficiency_confidence
```

## `market.career_skill_stats`

Aggregate skills across jobs to build a market baseline.

| Column | Meaning |
|---|---|
| `career_profile_id` | Career/Profile |
| `skill_id` | Skill |
| `analysis_start_date` | Start of analysis window |
| `analysis_end_date` | End of analysis window |
| `demand_count` | Jobs mentioning this skill |
| `total_jobs` | Jobs in the analysis window |
| `demand_percentage` | % Demand |
| `required_count` | Required count |
| `preferred_count` | Preferred count |
| `optional_count` | Optional count |
| `weighted_demand_score` | Demand score weighted by importance |
| `target_level` | Typical proficiency level expected by the market |
| `target_level_confidence` | Confidence in the target level |
| `level_observation_count` | Job descriptions with level information |
| `importance_tier` | core / important / optional |
| `last_updated` | Last aggregation time |

---

# 5. KNOWLEDGE — RAG / Skill Graph / Learning Content

## `knowledge.knowledge_sources`

Metadata for RAG sources; source files should be stored in S3.

| Column | Meaning |
|---|---|
| `source_id` | Source ID |
| `skill_id` | Related skill |
| `source_type` | official_docs / course / learning_path / article |
| `title` | Source title |
| `source_url` | URL |
| `storage_key` | S3 key |
| `publisher` | Publisher |
| `is_active` | Whether the source is active |
| `collected_at` | Collection time |
| `updated_at` | Last update time |

## `knowledge.knowledge_chunks`

Document chunks for semantic retrieval.

| Column | Meaning |
|---|---|
| `chunk_id` | Chunk ID |
| `source_id` | Source |
| `skill_id` | Related Skill |
| `topic` | prerequisite / concept / learning_outcome |
| `chunk_index` | Chunk order |
| `content` | Chunk text |
| `metadata` | Additional metadata |
| `embedding_model` | Model used for embedding |
| `embedding` | Vector stored with pgvector |
| `embedding_nova_model` | Nova embedding model used for retrieval |
| `embedding_nova` | 1,024-dimensional Nova vector stored with pgvector |
| `created_at` | Creation time |

## `knowledge.skill_dependencies`

Skill Knowledge Graph

```text
ETL Concepts
→ prerequisite_of
→ Apache Airflow
```

| Column | Meaning |
|---|---|
| `dependency_id` | ID |
| `prerequisite_skill_id` | Prerequisite skill |
| `target_skill_id` | Target skill |
| `dependency_type` | prerequisite / recommended_before / related |
| `strength` | required / strong / recommended / weak |
| `confidence` | Confidence |
| `source_id` | Supporting source |
| `evidence_text` | Evidence |
| `is_verified` | Whether the dependency has been validated |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `knowledge.learning_modules`

Learning scope for each skill and level.

| Column | Meaning |
|---|---|
| `module_id` | Module ID |
| `skill_id` | Skill |
| `level` | Level |
| `title` | Module title |
| `description` | Description |
| `learning_outcome` | What the learner should be able to do afterward |
| `sequence_order` | Order |
| `estimated_hours` | Estimated hours |
| `is_active` | Whether the record is active |
| `created_at` | Creation time |
| `updated_at` | Last update time |

---

# 6. APP — User & CV

## `app.users`

Account identity

| Column | Meaning |
|---|---|
| `user_id` | User ID |
| `email` | Email |
| `auth_provider` | Cognito / Google / local |
| `auth_subject` | External Auth ID |
| `password_hash` | Used only for local authentication |
| `is_active` | Account active |
| `created_at` | Creation time |
| `updated_at` | Last update time |

## `app.user_profiles`

Summary of user background used by the agent.

| Column | Meaning |
|---|---|
| `user_id` | User |
| `display_name` | Display name |
| `current_status` | student / employed_full_time / employed_part_time / between_opportunities / other |
| `current_job_title` | Current job title |
| `years_experience` | Total years of experience |
| `location` | Location |
| `education_level` | Education level |
| `field_of_study` | Field of study |
| `background_summary` | Summary for the agent |
| `updated_at` | Last update time |

## `app.resumes`

Resume upload metadata. The original CV is temporary and deleted after extraction; it is not archived in S3.

| Column | Meaning |
|---|---|
| `resume_id` | Resume ID |
| `user_id` | Owner |
| `file_name` | Generic filename; original filename is not retained |
| `storage_key` | Null after extraction because the original CV is not retained |
| `file_sha256` | Hash for duplicate/cache traceability; cannot recover the file |
| `mime_type` | File type |
| `file_size_bytes` | File size in bytes |
| `is_current` | Whether this is the current resume |
| `uploaded_at` | Upload time |
| `temporary_file_deleted_at` | When the temporary upload file was deleted after processing |
| `created_at` | Creation time |

## `app.resume_extractions`

LLM or resume parser output before user confirmation.

| Column | Meaning |
|---|---|
| `extraction_id` | Extraction ID |
| `resume_id` | Resume |
| `job_id` | Opaque API job ID used for status polling |
| `status` | pending / processing / completed / failed |
| `stage` | Current extraction stage |
| `model_provider` | Model provider |
| `model_name` | Model |
| `extracted_text` | Not populated; raw CV text is not retained |
| `extracted_json` | Structured pre-review extraction result |
| `prompt_version`, `extraction_schema_version`, `processing_version` | Reproducibility metadata |
| `review_status` | pending / confirmed / edited / rejected |
| `started_at` | Start time |
| `completed_at` | Completion time |
| `error_message` | Error |
| `created_at` | Creation time |
| `updated_at` | Last status/result update |

Durable CV extraction flow when DB is configured:

```text
Temporary CV Upload
↓
app.resumes (metadata, no file key)
↓
LLM Extraction
↓
app.resume_extractions (status + structured JSON, no raw text)
↓
Auto-fill UI
↓
User Edit / Confirm
↓
Canonical User Data
```

The temporary CV is deleted after the extraction attempt. Anonymous session IDs are sent with polling requests so the backend only returns a job to its owner. Without DB settings, the developer fallback still uses in-memory job state. See [Resume database mapping](../cv-extraction/05-database-mapping.md).

Roadmap generation already snapshots the assembled Agent Context in
`app.roadmap_generations.agent_context` in RDS. Keep those per-user, per-run
snapshots in the relational database; shared source documents and chunks remain
in the `knowledge.*` tables and this document workflow does not archive them to S3.

---

# 7. APP — Structured User Data

## `app.user_educations`

| Column | Meaning |
|---|---|
| `education_id` | ID |
| `user_id` | User |
| `institution_name` | Institution |
| `degree` | Degree |
| `field_of_study` | Field |
| `start_date` | Start |
| `start_date_precision` | Whether the source supplied a year, month, or exact day |
| `end_date` | End |
| `end_date_precision` | Precision of the source end date |
| `description` | Detail |
| `source` | resume / self_report |
| `source_resume_id` | Source resume |
| `extraction_confidence` | Confidence |
| `user_confirmed` | User confirm |
| `created_at` | Created |
| `updated_at` | Updated |

## `app.user_experiences`

Store work, internships, projects, competitions, and courses.

| Column | Meaning |
|---|---|
| `experience_id` | ID |
| `user_id` | User |
| `experience_type` | Experience type |
| `title` | Title |
| `organization` | Organization |
| `role` | Role / project role |
| `location` | Location |
| `url` | Project or portfolio URL |
| `description` | Detail |
| `highlights` | Ordered achievement/highlight values |
| `start_date` | Start |
| `start_date_precision` | Precision of the source start date |
| `end_date` | End |
| `end_date_precision` | Precision of the source end date |
| `is_current` | Whether this experience is current |
| `source` | resume / self_report |
| `source_resume_id` | Resume source |
| `extraction_confidence` | Confidence |
| `user_confirmed` | Confirmed |
| `created_at` | Created |
| `updated_at` | Updated |

## `app.user_skills`

The user's current skill state. Raw user skill labels are retained even before
they match the canonical catalog; only a successful match sets `skill_id`.
Resume ingestion must not create `core.skills` records implicitly.

| Column | Meaning |
|---|---|
| `user_skill_id` | User skill row ID |
| `user_id` | User |
| `skill_id` | Nullable canonical skill ID (external if databases split) |
| `raw_skill_name` | Original label from the resume or user |
| `normalized_skill_name` | Optional comparison text, not a canonical identity |
| `match_status` | matched / needs_review / unmatched |
| `proficiency_level` | Current level |
| `source` | resume / self_report / assessment / project |
| `confidence` | Confidence |
| `verification_type` | Verification method |
| `user_confirmed` | User confirm |
| `first_added_at` | Time first added |
| `updated_at` | Last update time |

## `app.user_skill_evidence`

Evidence supporting a user's claimed or inferred skill.

| Column | Meaning |
|---|---|
| `evidence_id` | ID |
| `user_skill_id` | User skill row supported by this evidence |
| `resume_id` | Resume source |
| `experience_id` | Experience source |
| `evidence_type` | resume_text / experience / assessment |
| `evidence_text` | Evidence |
| `confidence` | Confidence |
| `created_at` | Created |

## `app.user_certifications`

Certifications, awards, competitions, workshops, licenses, and other activities.

| Column | Meaning |
|---|---|
| `certification_id` | ID |
| `user_id` | User |
| `kind` | certification / award / competition / workshop / activity / license / other |
| `name` | Credential or activity name |
| `issuer` | Issuing organization |
| `awarded_on` | Date, when known |
| `awarded_on_precision` | Whether the source supplied a year, month, or exact day |
| `details` | Supporting detail |
| `source` | resume / self_report |
| `source_resume_id` | Resume source |
| `extraction_confidence` | Extraction confidence |
| `user_confirmed` | User confirmation |

---

# 8. APP — Career Goal

## `app.user_career_goals`

| Column | Meaning |
|---|---|
| `goal_id` | Goal ID |
| `user_id` | User |
| `target_role_title` | Selected role label from search or a recommendation |
| `career_id` | Nullable Career ID (external if databases split) until matched |
| `career_profile_id` | Nullable Career Profile ID (external if databases split) until matched |
| `is_primary` | Primary goal |
| `readiness_timeframe` | three_months / six_months / one_year / no_fixed_deadline |
| `target_date` | Target date |
| `weekly_availability` | under_2_hours / hours_2_to_5 / hours_5_to_10 / hours_10_plus |
| `available_hours_per_week` | Available hours per week |
| `preferred_learning_style` | Learning preference |
| `additional_context` | Optional user context, at most 500 characters |

| `created_at` | Created |
| `updated_at` | Updated |

Career recommendation match percentages and demand badges are derived from
the profile and market aggregates; they are not stored as onboarding input.
An unmatched custom role can be saved by title, but must be mapped to a career
profile before market comparison and roadmap generation.

---

# 9. APP — Roadmap & Progress

## `app.roadmaps`

Versioned roadmaps support replanning.

| Column | Meaning |
|---|---|
| `roadmap_id` | ID |
| `user_id` | User |
| `goal_id` | Goal whose roadmap is versioned |
| `career_id` | Career at generation time |
| `career_profile_id` | Career profile at generation time |
| `version` | Version within the goal |
| `title` | Title |
| `status` | draft / active / completed / replaced / archived |
| `generation_reason` | initial / progress_update / goal_change / market_update / feedback / manual_replan |
| `previous_roadmap_id` | Previous roadmap |
| `generated_at` | Agent generation time |
| `created_at` | Created |
| `updated_at` | Updated |

## `app.roadmap_steps`

| Column | Meaning |
|---|---|
| `roadmap_step_id` | ID |
| `roadmap_id` | Roadmap |
| `step_number` | Order |
| `skill_id` | Skill ID (external if databases split) |
| `module_id` | Learning Module ID (external if databases split) |
| `title` | Step title |
| `description` | Detail |
| `current_level` | Level at generation time |
| `target_level` | Target level |
| `reason` | Agent's reason for choosing the step |
| `estimated_hours` | Estimate |
| `is_required` | Required / optional |
| `created_at` | Created |

## `app.roadmap_tasks`

Checklist items for each roadmap step.

| Column | Meaning |
|---|---|
| `task_id` | ID |
| `roadmap_step_id` | Parent step |
| `task_number` | Order |
| `title` | Task |
| `description` | Detail |
| `is_required` | Required |
| `created_at` | Created |

## `app.user_roadmap_progress`

| Column | Meaning |
|---|---|
| `user_id` | User |
| `roadmap_step_id` | Step |
| `status` | not_started / in_progress / completed / skipped |
| `progress_percentage` | Progress |
| `user_note` | Note |
| `started_at` | Start |
| `completed_at` | Complete |
| `updated_at` | Update |

## `app.user_task_progress`

| Column | Meaning |
|---|---|
| `user_id` | User |
| `task_id` | Task |
| `status` | Status |
| `completed_at` | Complete |
| `updated_at` | Update |

---

# 10. Phase 2 — Application / Interview

## `app.job_applications`

Store the user's actual job applications.

## `app.application_feedback`

Store application feedback for replanning.

## `app.interview_sessions`

Store mock or AI interview sessions.

## `app.interview_feedback`

Store interview questions, answers, scores, and feedback.

These Phase 2 tables are outside the MVP scope.

---

# 11. Market ↔ App Integration

With one database, cross-schema foreign keys are possible. For example:

```text
app.user_skills.skill_id
→ core.skills.skill_id

app.user_career_goals.career_id
→ core.careers.career_id

app.roadmap_steps.module_id
→ knowledge.learning_modules.module_id
```

If the services later use separate databases, treat these fields as **external IDs** and validate them through service or API contracts instead of foreign keys.

---

# 12. MVP Data Flow

```text
1. User Upload CV
      ↓
2. Resume Extraction
      ↓
3. User Confirm / Edit
      ↓
4. Save User Profile / Skills / Experience
      ↓
5. User chooses Career Goal
      ↓
6. Load Market Career Baseline
      ↓
7. Compare User Skills vs Market Skills
      ↓
8. Load Skill Dependencies + Learning Modules
      ↓
9. Agent creates Roadmap
      ↓
10. User updates Progress
      ↓
11. Re-plan when needed
```

---

# 13. Recommended MVP Tables

## Market / Knowledge

```text
core.companies
core.careers
core.career_profiles
core.skills
core.skill_aliases
market.job_postings
market.job_search_matches
system.ingestion_runs
market.job_skills
market.career_skill_stats
knowledge.knowledge_sources
knowledge.knowledge_chunks
knowledge.skill_dependencies
knowledge.learning_modules
```

## App

```text
app.users
app.user_profiles
app.resumes
app.resume_extractions
app.user_educations
app.user_experiences
app.user_skills
app.user_skill_evidence
app.user_career_goals
app.roadmaps
app.roadmap_steps
app.roadmap_tasks
app.user_roadmap_progress
app.user_task_progress
```

## Optional operational tracking

`system.ai_runs` records AI operations after `app.users` exists. It is not required to create the first roadmap.

## Phase 2

```text
app.job_applications
app.application_feedback
app.interview_sessions
app.interview_feedback
```

---

# 14. Migration and Implementation Plan

- **Current implementation status:** migrations `001`–`007` in
  `data-pipeline/migrations/versions/` create the pipeline schemas (`core`,
  `market`, and `system`). Migration `008` in the root `migrations/versions/`
  creates the app profile, resume, career-goal, and roadmap tables plus
  `system.ai_runs`. The existing runner reads both locations in filename
  order. These files change a database only when the migration command is run;
  DBML files remain design references.
- Keep host-owned versioned migrations in root `migrations/versions/` and pipeline-owned migrations in `data-pipeline/migrations/versions/`. The runner applies both directories in one filename-ordered history for the shared database.
- Create `core` first, then `system.ingestion_runs`, `market`, `app`, and `knowledge`. Create `system.ai_runs` after `app.users` because it references a user. Check that the selected RDS PostgreSQL version supports pgvector, then enable the `vector` extension before adding vector columns or indexes ([AWS extension versions](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html)).
- Keep database access code in `backend/app/db/` and `data-engineering/db/`. Deployment configuration belongs in `infra/`; the current migration runner is `data-pipeline/scripts/database/migrate.py`.
- Coordinate migration changes across Backend and Data / RAG owners because one migration history affects all five schemas.

## Remaining decisions before future migrations

- Define numeric values for `requirement_score` and `proficiency_score`, and specify how `weighted_demand_score`, `target_level`, and `importance_tier` are derived.
- The app migration defines SQL constraints, deletion behavior, partial unique indexes for a current resume and primary goal, and range checks for scores and percentages. Fallback deduplication for postings without a provider ID remains to be defined.
- Review whether the app migration's deletion behavior and cross-domain foreign keys match the intended retention policy. A future database split would require service-level validation.
- Define the pgvector model, dimensions, and index strategy before creating `knowledge.knowledge_chunks.embedding`.
- Ensure an experience-linked skill evidence row refers to an experience owned by the same user. Define retention and access rules for resumes, extracted text, and other personal data before storing them in S3 or the database.
- Add the `app.roadmap_steps.module_id` foreign key after the knowledge migration creates `knowledge.learning_modules`.

---

# 15. Key Principle

```text
Market
= What employers demand

Knowledge
= What each skill means and how to learn it

App
= Who the user is, what they know, and their progress

Agent
= Use this information to choose the next action
```

The Glow-Job product flow is:

```text
Resume
→ User State
→ Career Goal
→ Market Skill Gap
→ Skill Knowledge
→ Personalized Roadmap
→ Progress
→ Re-plan
```



