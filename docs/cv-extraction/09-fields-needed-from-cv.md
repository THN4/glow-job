# 9. What the database needs from a CV (gap analysis)

> **Status (2026-10-05): P1, P2 (derived facts) and the P3 evidence/description items are implemented** in `app/cv_extraction/derive.py`, `schemas.py` and `postprocess.py` (see the table in 9.6). Still open: the skill-ID lookup against `core.skills` (needs the database), the `experience_type` mapping and the date/confidence conversions (they belong to the row mapper, task 7c).

Method: read every table in the canonical design ([docs/schemas/glow-job.dbml](../schemas/glow-job.dbml)), keep the ones a CV can fill, and compare their columns with what extraction produces today ([03-data-schema.md](03-data-schema.md)). The table-by-table mapping is in [08-database-mapping.md](08-database-mapping.md); this page is about **which fields are missing or should change**.

Legend: ✅ extracted today · ⚠ partly / needs conversion · ❌ not extracted today · 🧮 should be **computed in code** (not asked from the model) · 👤 comes from the user (onboarding), not from the CV.

## 9.1 Who consumes CV data, and what they need

| Consumer (from the DB design) | Reads | What it needs from the CV |
|---|---|---|
| **Skill Gap** (`ai/skill_gap`) | `app.user_skills` vs `market.career_skill_stats` | A **canonical skill** (`skill_id`) and a **proficiency level** on the same scale as the market's `target_level` (`beginner / intermediate / advanced / expert / unknown`). Gap = target level minus user level |
| **Priority engine / Roadmap** | `user_skills`, `knowledge.skill_dependencies`, `roadmap_steps.current_level` | The same: skill + current level, plus evidence that the user really has it |
| **Agent context** | `app.user_profiles` | `current_status`, `current_job_title`, `years_experience`, `education_level`, `field_of_study`, `location`, `background_summary` |
| **Auto-fill UI** (Figma step 2) | `resume_extractions.extracted_json` | Education, skills, projects, experience, certifications/activities, each with "please confirm" |

The skill level is the most important thing: the gap analysis cannot work without it, and the CV extraction does not produce it today.

## 9.2 Table by table

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
| `current_status` (student / employed / career_switcher) | yes | ❌ | 👤 onboarding step 4 ("Current situation"). The CV can only **suggest** it: ongoing education → student; ongoing job → employed. Prefill, never decide |

### `app.user_educations`

| Column | Need | Status | Notes |
|---|---|---|---|
| `institution_name`, `degree`, `field_of_study` | yes | ✅ | |
| `start_date`, `end_date` (`date`) | yes | ⚠ | We have `"YYYY"` / `"YYYY-MM"` strings. Convert to the first day of the period. Ongoing → `end_date = NULL` |
| `description` | optional | ⚠ | Only `gpa`. Honors, thesis topic and relevant courses are lost. Add a short `description` (optional field) |
| `extraction_confidence` `numeric(4,3)` | yes | ⚠ | We have `high/medium/low`; map to 0.9 / 0.6 / 0.3 |
| `source`, `source_resume_id`, `user_confirmed` | yes | n/a | Set by the backend |

### `app.user_experiences` (work, internships, projects, competitions, courses)

| Column | Need | Status | Notes |
|---|---|---|---|
| `experience_type` **NOT NULL** (`work / internship / project / competition / course / other`) | yes | ⚠ | We know it from the section (`experience` → work/internship, `projects` → project, certification kinds → competition/course/other). A volunteer role, a freelance gig and a thesis are easy to misfile: see 9.3 |
| `title` **NOT NULL** | yes | ⚠ | `title` / project `name` / certification `name`. Can be `null` today, so the review step must require it |
| `organization` | yes | ✅ | experience `organization`, certification `issuer`. A project has none |
| `description` | yes | ✅ | `description` + `highlights` (+ certification `detail`) |
| `start_date`, `end_date` | yes | ⚠ | Same conversion as above |
| `extraction_confidence` | yes | ⚠ | Same mapping |

### `app.user_skills` (PK `user_id, skill_id`)

| Column | Need | Status | Notes |
|---|---|---|---|
| `skill_id` → `core.skills` | **yes** | ⚠ | We extract a **name**. It must be matched to `core.skills` through `core.skill_aliases` (alias is unique). Our `skill_aliases.py` is only a stand-in. Skills with no match need a policy (decision D2 in doc 08) |
| `proficiency_level` (5 values) | **yes, key field** | ❌ | See 9.3 (P1) |
| `source` (`resume`), `confidence` | yes | ⚠ | `source='resume'`; confidence mapping as above |
| `verification_type` | optional | ❌ | e.g. `certification` when a certificate covers the skill; otherwise empty (a CV claim is unverified) |
| `user_confirmed` | yes | n/a | Set when the user saves |

### `app.user_skill_evidence`

| Column | Need | Status | Notes |
|---|---|---|---|
| `skill_id`, `resume_id`, `experience_id` | yes | ⚠ | We know which experience/project lists a technology (`technologies`), so the link exists |
| `evidence_type` | yes | ⚠ | `experience` when found under a job/project, `resume_text` when only in a skills list |
| `evidence_text` | yes | ❌ | A short quote from the CV showing the skill used. 🧮 Find the sentence containing the skill (any alias) in the extracted text. No model needed. For scans/photos there is no text, so use the item's description |
| `confidence` | yes | ⚠ | Higher when the skill appears in an experience/project than in a bare list |

### Not from the CV

`app.users` (login), `user_career_goals`, `roadmaps*`, `*_progress`: come from auth, onboarding steps 3-4 (career goal, hours per week, learning style) and the agent. `core.*`, `market.*`, `knowledge.*`: data engineering / RAG. `app.resumes` and `app.resume_extractions` / `system.ai_runs` are filled by the backend around the extraction (see doc 08).

## 9.3 Gaps and proposals

| Pri | Gap | Proposal | Where |
|---|---|---|---|
| **P1** | **Skill proficiency level is not extracted** | Add an optional `proficiency` to each `technicalSkill`: one of the DB enum values **only when the CV says it** ("Python (advanced)", "basic SQL", "expert in Docker", "familiar with", "fluent"), otherwise `unknown`. Then 🧮 **infer** the rest in code when it is `unknown`: months of use = sum of the experiences/projects listing the skill (≥ 5 y → advanced, 2-5 y → intermediate, < 2 y → beginner; a certification can raise one step). Store the basis (`explicit` / `inferred` / `unknown`) in the result, and flag inferred levels `needsReview` so the user adjusts them in the review screen. This keeps the small model's job simple (copy the words) and the policy testable | `schemas.py` (`TechnicalSkillAi.proficiency`), `prompt.py`, new `postprocess` step |
| **P1** | **Skill names are not canonical IDs** | A lookup function `resolve_skill(name) -> skill_id \| None` against `core.skills` + `core.skill_aliases`. In local mode it keeps using `skill_aliases.py`; the backend swaps in the DB. Report unmatched names | `skill_aliases.py` (the function boundary already exists: `normalize_skill_name`) |
| P2 | `years_experience`, `current_job_title`, `education_level`, `field_of_study` are not produced | 🧮 Add a `derived` block to the result (`yearsExperience`, `currentJobTitle`, `educationLevel`, `fieldOfStudy`, `suggestedStatus`) computed from the extracted data. It also speeds up the review screen | new `derive.py` + tests |
| P2 | Dates are strings with year or month precision | Keep the strings in `extracted_json`; convert to `date` only when writing rows (`YYYY` → `YYYY-01-01`). `years_experience` should use months where known | mapper (task 7c) |
| P2 | `experience_type` must be set for every item | Ask the model for it **only where the section is ambiguous**: add `experienceType` to `experience` items (`work / internship / volunteer / freelance`...→ DB `work / internship / other`), and map project/competition/course from their sections. Alternatively keep the current sections and map in code (no model change) | `schemas.py` or mapper |
| P3 | `evidence_text` per skill | 🧮 From the extracted text (sentence containing the skill) | postprocess |
| P3 | Education `description` (honors, thesis) | Add optional `description` to `education` | `schemas.py` |
| P3 | Confidence is 3-level, DB wants a number | Keep the 3 levels (small models are poorly calibrated), map to 0.9 / 0.6 / 0.3 | mapper |

Cost of the model-side changes (P1 `proficiency`, P2 `experienceType`, P3 education `description`): about 3 extra short fields per item, roughly +5-10 % output tokens, so +5-10 s on the current setup. Everything marked 🧮 adds no model cost.

## 9.4 Extracted today but not stored in the canonical tables

Kept only in `resume_extractions.extracted_json` (still useful for the review screen and for later features): `personal.email` (belongs to `app.users`), `phone`, `links`, `headline`, `softSkills`, `languages`, certification `issuer` / `date` / `detail` (partly folded into `user_experiences`), experience `location`, `employmentType`, `highlights` (folded into the description), and `warnings`.

If the roadmap agent needs languages or certifications as first-class data, that is a schema change request to the team (decision D3 in doc 08). The CV side already extracts them.

## 9.5 Suggested order

1. **P1 skill proficiency** (model field + code inference + review flag) and **canonical skill lookup**. These unlock Skill Gap.
2. **P2 derived profile fields** (`yearsExperience`, `educationLevel`, `currentJobTitle`, `suggestedStatus`). No model change.
3. The row mapper (task 7c) once the team has decided D1-D4.
4. P3 items.

All steps are backward compatible: new fields are optional or derived, so the API and the frontend contract only gain fields.

## 9.6 What was implemented

| Item | Where | Notes |
|---|---|---|
| Skill `proficiency` (model, explicit only) | `schemas.py` `TechnicalSkillAi.proficiency`, `prompt.py` | Required field, value `"unknown"` unless the CV states a level |
| Explicit level read by code | `derive.explicit_level_from_text` | English and Thai keywords, looked up only inside the comma/line-separated segment that holds the skill, whole-word matching (`Go` ≠ `Google`). With the CV text available **the code decides**: a model-claimed level that the text doesn't show is dropped. For scans/photos the model's level is trusted |
| Inferred level | `derive.infer_level`, `skill_usage` | Union of the months of the jobs/projects that list or mention the skill (year-only dates count mid-year; ongoing ends today; undated projects +2 months). `< 24` months beginner, `< 60` intermediate, otherwise advanced. **Never "expert"** (only an explicit claim gives that). A certification that names the skill lifts it to at least intermediate |
| `proficiencyBasis` | `explicit` / `inferred` / `unknown` | The UI can show "estimated" next to inferred levels. **Deviation from the proposal above:** inferred levels do **not** set `needsReview`: a CV with 15 skills would get 15 "Please confirm" badges and bury the real doubts |
| Skill `evidence` | `derive.skill_usage`, `snippet_with_skill` | Linked jobs/projects (with their `id`) and, if none, the CV sentence mentioning the skill. At most 3 |
| `derived` block | `derive.derive_profile` | `yearsExperience` (merged overlaps, volunteering excluded), `currentJobTitle`, `educationLevel` (English + Thai degree names), `fieldOfStudy`, `suggestedStatus` (an internship alone doesn't make someone "employed"). Recomputed in `PUT /profiles` from the user's edits |
| Education `description` | `schemas.py`, `prompt.py` | |
| Tests | `tests/test_derive.py` (20), plus API and schema tests | |

Not done (needs the database or a decision): `resolve_skill()` against `core.skills`, `experience_type` mapping, date → `date` and confidence → numeric conversions, and the PostgreSQL row writer.

