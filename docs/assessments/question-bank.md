# Question bank: load, generate, review

Questions live in `app.assessment_items` (migrations 017-018). Every item is a single-answer question with
four options, tied to the knowledge chunk whose text supports the answer. Two sources fill it:

| Source | Status | Used by |
|---|---|---|
| Offline drafts (Gemini), reviewed by a person | `approved` | step checks and level checks |
| On-demand drafts written while a learner waits | `provisional` | step checks only, until reviewed |

A step check uses provisional questions for a chunk only while that chunk has no approved one.

## Load the reviewed seed bank (do this first)

[ai/assessments/seed/demo_bank.json](../../ai/assessments/seed/demo_bank.json) holds 13 reviewed questions
(Apache Airflow 10, enough for a full level check; RAG 3) and the self-check statements (generic, plus
Airflow, Docker and Git). Every quote was checked against its chunk.

```cmd
:: from the repository root, after migrations 001-017
set PYTHONPATH=.;data-pipeline
backend\.venv\Scripts\python -m scripts.assessments.load_bank --file ai/assessments/seed/demo_bank.json --dry-run
backend\.venv\Scripts\python -m scripts.assessments.load_bank --file ai/assessments/seed/demo_bank.json
```

The loader compares each quote with `knowledge.knowledge_chunks` and the stored content hash, and skips
items that no longer match. Re-running updates items with the same skill and question text.
`--skip-source-check` exists only for test databases without knowledge data.

## Draft more questions with Gemini

```cmd
backend\.venv\Scripts\python -m scripts.assessments.generate_items --skill-id 85 --output rag/data/assessments/bank-85.json --allow-model-calls
:: only the chunks a roadmap cites, steering levels toward 3 approved questions each
backend\.venv\Scripts\python -m scripts.assessments.generate_items --skill-id 103 --chunk-ids 20 42 --per-level 3 --output ... --allow-model-calls
```

Chunks that already have approved or provisional questions are skipped (`--include-existing` to keep
them), and questions whose text is already in the bank are dropped.

1. For each chunk mapped to the skill, Gemini writes up to two questions with a level and the exact supporting quote.
2. Code drops questions whose quote is not in the chunk, or with repeated or "all of the above" options.
3. Gemini answers each question again without the key. A different answer adds the flag `BLIND_ANSWER_DISAGREES`.
4. The file is a draft (`status: "draft"`). Only public document text and the skill name are sent.

## Review (lightweight)

Open the draft file. Check every flagged item, and spot-check about one in five of the others:
the answer must follow from the quote, and the wrong options must be clearly wrong. Set `status` to
`approved` or `rejected` (you can also fix wording or the level), then run `load_bank` on the file.

A level check uses a quiz only when the skill has at least 3 approved questions at each of beginner,
intermediate and advanced. Otherwise it falls back to the self-check. Step checks work with any number
of approved questions on the chunks a step's study tasks cite.

## On-demand questions for step checks

Switch on in `backend/.env` (off by default):

```env
ASSESSMENT_AI_GENERATION=gemini
GEMINI_API_KEY=...
ASSESSMENT_DAILY_GENERATIONS=50      # chunks per day, about two Gemini calls each
ASSESSMENT_GENERATION_TIMEOUT_S=20   # longest wait in a step check
```

When a study task's chunks have no usable question, the backend
([generator.py](../../backend/app/features/assessments/generator.py)) writes up to two from the task's first
chunk while the learner waits (up to 4 chunks per check, in parallel):

1. The same prompt and code checks as offline drafts.
2. A strict blind check: a question is dropped if the second answer disagrees or fails.
3. Kept as `provisional` (`generated_by: gemini-on-demand`) and reused by every later learner.

Guards: one run per chunk at a time (two learners at once cause one run), the daily cap, no new run for
7 days after a run that kept nothing or 1 hour after a failure (`app.assessment_generations`), and the time
limit (a slow run still saves its questions for the next learner). If nothing is ready, the check answers
`NO_CHECK_QUESTIONS` as before. A level check without a full approved quiz uses the self-check and asks
for drafts of up to two more chunks of that skill in the background.

## Review provisional questions

```cmd
backend\.venv\Scripts\python -m scripts.assessments.export_review --output rag/data/assessments/review-2026-10-23.json
```

Review the file as above, set `status` to `approved` or `rejected`, then load it with `load_bank`.
Approved questions also count toward level checks.
