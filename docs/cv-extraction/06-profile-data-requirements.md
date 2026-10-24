# Profile Data Requirements

> **Current boundary:** `DatabaseProfilesRepo` persists confirmed anonymous profiles in `app.user_profiles` and normalized education, experience/project, skill/evidence, and certification rows. The full profile JSON preserves fields without relational columns. Resume files and extraction jobs remain temporary/in-memory; career goals and roadmap preferences are not yet saved by this Resume flow.

Method: read the relevant tables in the canonical design ([docs/schemas/glow-job.dbml](../schemas/glow-job.dbml)), keep the ones a CV can fill, and compare their columns with the extraction contract ([02-profile-schema.md](02-profile-schema.md)). The table-by-table mapping is in [05-database-mapping.md](05-database-mapping.md); this page is about **which fields are needed by downstream consumers**.

Legend: ✅ extracted today · ⚠ partly / needs conversion · ❌ not extracted today · 🧮 should be **computed in code** (not asked from the model) · 👤 comes from the user (onboarding), not from the CV.

## 6.1 Who consumes CV data, and what they need

| Consumer (from the DB design) | Reads | What it needs from the CV |
|---|---|---|
| **Skill Gap** (`ai/skill_gap`) | `app.user_skills` vs `market.career_skill_stats` | A **canonical skill** (`skill_id`) and a **proficiency level** on the same scale as the market's `target_level` (`beginner / intermediate / advanced / expert / unknown`). Gap = target level minus user level |
| **Priority engine / Roadmap** | `user_skills`, `knowledge.skill_dependencies`, `roadmap_steps.current_level` | The same: skill + current level, plus evidence that the user really has it |
| **Agent context** | `app.user_profiles` | `current_status`, `current_job_title`, `years_experience`, `education_level`, `field_of_study`, `location`, `background_summary` |
| **Profile review step** | In-memory extraction result before confirmation; confirmed result in `app.user_profiles.profile_data` | Education, skills, projects, experience, certifications/activities for user review; frontend presentation is replaceable |

Skill proficiency is now extracted when explicitly stated, otherwise estimated from experience/project evidence where possible. A profile may still have `unknown` proficiency when the CV has too little evidence; downstream gap analysis must handle that honestly rather than treating it as beginner.

## 6.2 Table by table

### `app.user_profiles` (one row per user)

| Column | Need | Status | Source |
|---|---|---|---|
| `display_name` | yes | ✅ `personal.fullName` | model |
| `location` | yes | ✅ `personal.location` | model |
| `background_summary` | yes | ✅ `summary` (many CVs have none) | model; fall back to a generated one-liner later |
| `current_job_title` | yes | ⚠ derivable | 🧮 title of the experience with `isCurrent`, else the most recent one |
| `years_experience` `numeric(5,2)` | yes | ❌ | 🧮 sum of work/internship durations (merge overlaps; ongoing = until today). Needs real dates (see 9.3) |
| `education_level` | yes | ❌ | 🧮 from the highest `degree` (B.Sc./B.Eng. → bachelor, M.Sc. → master, Ph.D. → doctorate, Diploma/ปวส. → diploma). Mapping table in code, `unknown` otherwise |
| `field_of_study` | yes | ⚠ | 🧮 `fieldOfStudy` of the highest degree |
| `current_status` (student / employed full-time / employed part-time / between opportunities / other) | yes | ❌ | 👤 onboarding step 4 ("Current situation"). The CV can only **suggest** it; the user chooses the saved value |

### `app.user_educations`

| Column | Need | Status | Notes |
|---|---|---|---|
| `institution_name`, `degree`, `field_of_study` | yes | ✅ | |
| `start_date`, `end_date` plus precision | yes | ⚠ | Convert `"YYYY"` / `"YYYY-MM"` to the first day of the period and store `date_precision` so year/month precision is not lost. Ongoing → `end_date = NULL` |
| `description` | optional | ⚠ | Only `gpa`. Honors, thesis topic and relevant courses are lost. Add a short `description` (optional field) |
| `extraction_confidence` `numeric(4,3)` | yes | ⚠ | We have `high/medium/low`; map to 0.9 / 0.6 / 0.3 |
| `source`, `source_resume_id`, `user_confirmed` | yes | n/a | Set by the backend |

### `app.user_experiences` (work, internships, projects, competitions, courses)

| Column | Need | Status | Notes |
|---|---|---|---|
| `experience_type` **NOT NULL** (`work / internship / project / competition / course / other`) | yes | ⚠ | We know it from the section (`experience` → work/internship, `projects` → project). A volunteer role, a freelance gig and a thesis still need a mapping policy: see 9.3 |
| `title` **NOT NULL** | yes | ⚠ | `title` / project `name` / certification `name`. Can be `null` today, so the review step must require it |
| `organization`, `role`, `location`, `url` | yes | ⚠ | Stored where provided; project role and URL can remain null |
| `description`, `highlights`, `is_current` | yes | ⚠ | Description and ordered highlights are stored separately; current roles use `is_current=true` and no end date |
| `start_date`, `end_date` plus precision | yes | ⚠ | Same conversion as education, with source precision retained |
| `extraction_confidence` | yes | ⚠ | Same mapping |

### `app.user_skills`

| Column | Need | Status | Notes |
|---|---|---|---|
| `raw_skill_name`, `match_status` | **yes** | ✅ | Preserve the exact observed label even if it is not yet in the canonical catalog |
| `skill_id` → `core.skills` | needed for market comparison | ⚠ | Match through `core.skills` and `core.skill_aliases` when possible. Leave null and mark unmatched/needs-review otherwise; never create catalog skills as an ingestion side effect |
| `proficiency_level` (5 values) | **yes, key field** | ❌ | See 9.3 (P1) |
| `source` (`resume`), `confidence` | yes | ⚠ | `source='resume'`; confidence mapping as above |
| `verification_type` | optional | ❌ | e.g. `certification` when a certificate covers the skill; otherwise empty (a CV claim is unverified) |
| `user_confirmed` | yes | n/a | Set when the user saves |

### `app.user_skill_evidence`

| Column | Need | Status | Notes |
|---|---|---|---|
| `user_skill_id`, `resume_id`, `experience_id` | yes | ⚠ | Evidence points to the user's skill row, which can be matched or still unresolved |
| `evidence_type` | yes | ⚠ | `experience` when found under a job/project, `resume_text` when only in a skills list |
| `evidence_text` | yes | ❌ | A short quote from the CV showing the skill used. 🧮 Find the sentence containing the skill (any alias) in the extracted text. No model needed. For scans/photos there is no text, so use the item's description |
| `confidence` | yes | ⚠ | Higher when the skill appears in an experience/project than in a bare list |

### Not from the CV

`app.users` is created with an anonymous `sessionId` subject for now; login is not part of the current plan. `user_career_goals`, `roadmaps*`, and `*_progress` come from onboarding steps 3-4 and the agent, and are not saved by this Resume profile endpoint yet. `core.*`, `market.*`, `knowledge.*`: data engineering / RAG. The Backend now writes upload metadata and extraction state/result to `app.resumes` / `app.resume_extractions` when DB settings are configured; the temporary CV file and extracted raw text are not retained (see [05-database-mapping.md](05-database-mapping.md)).

## 6.3 Mapping behavior now implemented

| Area | Current behavior | Limit |
|---|---|---|
| Skill proficiency | The extractor returns an explicit level only when supported by the CV; code can infer a level from dated work/project evidence and records `proficiencyBasis` as `explicit`, `inferred`, or `unknown`. | A CV with sparse dates or mentions can remain `unknown`; inferred values should be presented as estimates. |
| Canonical skill IDs | At extraction display and save, backend applies the shared deterministic exact-name/alias matcher against `core.skills` and `core.skill_aliases`. | Unmatched names remain user skills with no `skill_id`; Resume never inserts new catalog skills. |
| Derived profile fields | Code computes `yearsExperience`, `currentJobTitle`, `educationLevel`, `fieldOfStudy`, and `suggestedStatus`. | These are suggestions derived from incomplete CV data, not verified identity claims. |
| Dates and experience type | Partial dates are stored as dates plus precision; experiences/projects are mapped to the existing enum. | The original strings remain in `profile_data`; detailed source CV/job history is not retained. |
| Evidence and confidence | Skill evidence is linked to normalized experience/project rows where possible; confidence values map from high/medium/low to 0.9/0.6/0.3. | Evidence may be absent when the skill appears only in a skills list. |
| Education details | `description` carries honors, thesis, or notable coursework when the model finds them. | Extraction completeness still depends on CV readability and model output. |

## 6.4 Extracted today but not stored in dedicated canonical tables

Kept in `app.user_profiles.profile_data` rather than dedicated columns: `personal.email` (it is not an account email), phone, links, headline, `softSkills`, `languages`, and warnings. They remain available to reload the confirmed profile. Certifications, issuer/date/details, experience location/highlights, and project URLs are also represented in normalized tables.

If the roadmap agent needs languages or soft skills as first-class data, that is a separate schema decision. The profile schema gives certifications and activities first-class storage, independent of which frontend presents them.

## 6.5 Remaining work

1. Persist career goal and preference answers from onboarding steps 3-4 to `app.user_career_goals`.
2. Apply migration `022_persist_resume_extraction_jobs.sql` in environments that need durable extraction records. The uploaded CV remains temporary; only metadata, structured extraction JSON, job state, and provenance are retained.
3. The current product plan is anonymous access; there is no login or account-linking work in scope.

## 6.6 What was implemented

| Item | Where | Notes |
|---|---|---|
| Skill `proficiency` (model, explicit only) | `schemas.py` `TechnicalSkillAi.proficiency`, `prompt.py` | Required field, value `"unknown"` unless the CV states a level |
| Explicit level read by code | `derive.explicit_level_from_text` | English and Thai keywords, looked up only inside the comma/line-separated segment that holds the skill, whole-word matching (`Go` ≠ `Google`). With the CV text available **the code decides**: a model-claimed level that the text doesn't show is dropped. For scans/photos the model's level is trusted |
| Inferred level | `derive.infer_level`, `skill_usage` | Union of the months of the jobs/projects that list or mention the skill (year-only dates count mid-year; ongoing ends today; undated projects +2 months). `< 24` months beginner, `< 60` intermediate, otherwise advanced. **Never "expert"** (only an explicit claim gives that). A certification that names the skill lifts it to at least intermediate |
| `proficiencyBasis` | `explicit` / `inferred` / `unknown` | A client can show "estimated" next to inferred levels. **Deviation from the proposal above:** inferred levels do **not** set `needsReview`: a CV with 15 skills would get 15 "Please confirm" badges and bury the real doubts |
| Skill `evidence` | `derive.skill_usage`, `snippet_with_skill` | Linked jobs/projects (with their `id`) and, if none, the CV sentence mentioning the skill. At most 3 |
| `derived` block | `derive.derive_profile` | `yearsExperience` (merged overlaps, volunteering excluded), `currentJobTitle`, `educationLevel` (English + Thai degree names), `fieldOfStudy`, `suggestedStatus` (an internship alone doesn't make someone "employed"). Recomputed in `PUT /profiles` from the user's edits |
| Education `description` | `schemas.py`, `prompt.py` | |
| Tests | `data-pipeline/tests/resume/test_derive.py`, plus backend API integration tests | |

The PostgreSQL row writer and deterministic catalog matching are implemented in `backend/app/features/resume/profiles.py` and `backend/app/features/resume/catalog.py`. The DB adapter recomputes catalog matches on save, stores unmatched labels without adding catalog entries, converts partial dates and confidence values, and writes the confirmed profile atomically. Remaining gaps are listed in §6.5.

