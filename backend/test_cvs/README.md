# Sample CVs for testing

10 **fictional** CVs (made-up people, `example.com` emails, no real personal data) covering different fields, layouts, languages and file types. Regenerate them any time with:

```powershell
python -m tests.make_sample_cvs
```

`manifest.json` lists expected facts (name, schools, companies, skills, projects, and selected proficiency levels). It is the versioned gold-set manifest for the resume extraction quality evaluation.

| # | File | Type | Language | What it tests |
|---|---|---|---|---|
| 01 | `01-fullstack-developer-en.pdf` | text PDF, 1 page | English | Baseline: single column, jobs, project, skills, certifications |
| 02 | `02-data-analyst-en.pdf` | text PDF, 2 pages | English | Summary, 3 jobs, master's degree, certifications, projects |
| 03 | `03-fresh-graduate-en.pdf` | text PDF, 1 page | English | **No work experience**: `experience` must stay empty (no invented jobs) |
| 04 | `04-thai-developer-th.pdf` | text PDF, 1 page | Thai | Fully Thai CV. Dates use the **Buddhist Era** (พ.ศ. 2559-2563 = 2016-2020): the backend converts them to 2016-2020 and flags them "needs review" |
| 05 | `05-mixed-thai-english.pdf` | text PDF, 1 page | Thai + English | English CV with Thai names, Thai university and Thai bullet points |
| 06 | `06-designer-two-column-en.pdf` | text PDF, 1 page | English | Two-column layout with a sidebar: tests reading order |
| 07 | `07-senior-devops-long-en.pdf` | text PDF, 3 pages | English | Long input: 4 jobs, many skills and certifications |
| 08 | `08-scanned-fresh-graduate.pdf` | scanned PDF (image only) | English | No text layer. Gemini receives prepared page images |
| 09 | `09-phone-photo-data-analyst.jpg` | JPEG photo | English | Rotated, uneven light, noise; Gemini receives the prepared image |
| 10 | `10-not-a-cv-receipt.pdf` | text PDF | English | Not a CV: must fail with `NOT_A_CV` |

Files 08 and 09 are supported by the Gemini extractor without a separate vision setting.

## Gemini quality evaluation

From `data-pipeline/`, validate that all manifest files are present without
making model requests:

```powershell
python -m scripts.resume.evaluate_samples --dry-run
```

To run the selected CVs through Gemini, set `RESUME_EXTRACTOR=gemini` and
`GEMINI_API_KEY` in the environment, then explicitly enable model calls:

```powershell
python -m scripts.resume.evaluate_samples --run-model
```

Use `--case 04-thai-developer-th.pdf` to evaluate one case, or repeat `--case`
to select several. Each model run writes a timestamped JSON report under
`data/processed/resume_evaluation/`; pass `--output <path>` to choose another
destination. The summary reports recall for expected manifest facts only. It
does not measure precision or approve the model for production; review the
per-case actual values, warnings, review flags, latency, and token usage too.
When a request fails, `providerDiagnostic` records the SDK's underlying error
detail (with API-key patterns redacted) so an HTTP 400 can be diagnosed. A
single case can be rerun with `--case <filename>` before retrying the full set.

## Historical prototype results with `vegeta/qwen3.5-4b-mtp:q8` (Ollama, 2026-10-05)

These results predate the current Gemini-based extraction flow and are kept as experiment history only.

| File | Time | Result |
|---|---|---|
| 08 scanned PDF | 43 s | Correct: name, school, skills, both projects, no jobs, nothing flagged |
| 09 phone photo | 107 s | Correct: 3 jobs, both degrees, 15 skills/tools, nothing flagged |
| 04 Thai | 60 s | Correct names/skills; BE dates converted (2016-2020, 2020-06...) and flagged for review |
| 06 two-column | 86 s | Correct: 3 jobs, school, both projects. 1 item flagged (an invented soft skill, "Mentoring") |
| 03 fresh graduate | 34 s | Correct: no experience invented, nothing flagged |
| 10 receipt | 13 s | Detected as not a CV |

Not yet run on the real model: 01, 02, 05, 07.

## Try them

From `data-pipeline/` with the environment active. Single file, no server needed:

```powershell
python -m scripts.resume.extract ..\backend\test_cvs\01-fullstack-developer-en.pdf
```

Through the API (start the server first with `uvicorn app.main:app --port 8787`, in another terminal):

```powershell
python -m scripts.resume.try_api ..\backend\test_cvs\04-thai-developer-th.pdf
```

All 10 files in a row, printing the final status of each (use `RESUME_EXTRACTOR=mock` in `.env` for an instant dry run):

```powershell
Get-ChildItem ..\backend\test_cvs\*.pdf, ..\backend\test_cvs\*.jpg | ForEach-Object { "== $($_.Name)"; python -m scripts.resume.try_api $_.FullName | Select-String '"status"|"code"' }
```

## Where to look in the output

- `profile.<section>[*].needsReview` is the "Please confirm" flag. Low confidence, a missing key field, an item not found in the CV text, or an implausible date all set it.
- `meta.reviewCount` and `meta.warnings` summarize it.
- `meta.cached: true` means the same file was already processed in the last 24 hours (no model call).
