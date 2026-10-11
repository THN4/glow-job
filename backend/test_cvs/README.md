# Sample CVs for testing

10 **fictional** CVs (made-up people, `example.com` emails, no real personal data) covering different fields, layouts, languages and file types. Regenerate them any time with:

```powershell
python -m tests.make_sample_cvs
```

`manifest.json` lists what each file should produce (name, schools, companies, skills). It is meant for hand checks now and for the accuracy evaluation later (task 8 in `.kiro/specs/cv-extraction/tasks.md`).

| # | File | Type | Language | What it tests |
|---|---|---|---|---|
| 01 | `01-fullstack-developer-en.pdf` | text PDF, 1 page | English | Baseline: single column, jobs, project, skills, certifications |
| 02 | `02-data-analyst-en.pdf` | text PDF, 2 pages | English | Summary, 3 jobs, master's degree, certifications, projects |
| 03 | `03-fresh-graduate-en.pdf` | text PDF, 1 page | English | **No work experience**: `experience` must stay empty (no invented jobs) |
| 04 | `04-thai-developer-th.pdf` | text PDF, 1 page | Thai | Fully Thai CV. Dates use the **Buddhist Era** (พ.ศ. 2559-2563 = 2016-2020): the backend converts them to 2016-2020 and flags them "needs review" |
| 05 | `05-mixed-thai-english.pdf` | text PDF, 1 page | Thai + English | English CV with Thai names, Thai university and Thai bullet points |
| 06 | `06-designer-two-column-en.pdf` | text PDF, 1 page | English | Two-column layout with a sidebar: tests reading order |
| 07 | `07-senior-devops-long-en.pdf` | text PDF, 3 pages | English | Long input: 4 jobs, many skills and certifications |
| 08 | `08-scanned-fresh-graduate.pdf` | scanned PDF (image only) | English | No text layer. **Needs a vision model** (`LLM_VISION=true`) |
| 09 | `09-phone-photo-data-analyst.jpg` | JPEG photo | English | Rotated, uneven light, noise. **Needs a vision model** |
| 10 | `10-not-a-cv-receipt.pdf` | text PDF | English | Not a CV: must fail with `NOT_A_CV` |

Files 08 and 09 need a vision model and `LLM_VISION=true` in `.env` (otherwise they fail with a clear `UNREADABLE_DOCUMENT` message).

## Results with `vegeta/qwen3.5-4b-mtp:q8` (Ollama, 2026-10-05)

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
python -m scripts.resume.extract ..\backend\test_resume\01-fullstack-developer-en.pdf
```

Through the API (start the server first with `uvicorn app.main:app --port 8787`, in another terminal):

```powershell
python -m scripts.resume.try_api ..\backend\test_resume\04-thai-developer-th.pdf
```

All 10 files in a row, printing the final status of each (a real model takes 1-2 minutes per file; use `EXTRACTOR=mock` in `.env` for an instant dry run):

```powershell
Get-ChildItem ..\backend\test_resume\*.pdf, ..\backend\test_resume\*.jpg | ForEach-Object { "== $($_.Name)"; python -m scripts.resume.try_api $_.FullName | Select-String '"status"|"code"' }
```

## Where to look in the output

- `profile.<section>[*].needsReview` is the "Please confirm" flag. Low confidence, a missing key field, an item not found in the CV text, or an implausible date all set it.
- `meta.reviewCount` and `meta.warnings` summarize it.
- `meta.cached: true` means the same file was already processed in the last 24 hours (no model call).
