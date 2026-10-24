# Assessments API contract

Base URL `http://localhost:8787/api`. Every request needs `X-Session-Id`, the anonymous session that
saved the profile. Errors use the shared envelope `{"error": {"code", "message", "retryable"}}`.
Types for the frontend: [frontend/src/features/assessments/types.ts](../../frontend/src/features/assessments/types.ts).
Design and rules: [assessment-plan.md](assessment-plan.md) (design v3).

All paths below start with `/profiles/{profileId}/assessments`.

## Overview (Assessments page)

| Method | Path | Response |
|---|---|---|
| GET | `` (the prefix itself) | `{stats, levelChecks, stepChecks, activity}` |

- `stats`: `verifiedTasks` (from applied step checks), `skillsWithLevel`, `profileSkills`.
- `levelChecks`: profile skills plus skills with reviewed questions. `level` is null when unknown.
  `hasQuiz` is true only when every level has at least 3 reviewed questions. `reason` is display text.
- `stepChecks`: the latest finished step check per `stepKey`, with `verifiedTaskIds` and `reviewTaskIds`.
- `activity`: finished checks of every kind, newest first.

## Step check

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/step-checks` | `{stepKey, skillId?, roadmapId?, tasks?, entryPoint?}` | `201 {assessmentId, stepKey, taskCount, questions}` |
| POST | `/{assessmentId}/finish` | `{answers: [{itemId, choice}]}` | `{verifiedCount, taskCount, tasks: [{taskId, label, verified, questions: AnswerReview[]}]}` |
| POST | `/{assessmentId}/apply` | `{apply: true \| false}` | `{decision, verifiedTaskIds, reviewTaskIds}` |

- With `roadmapId`, the server reads the study tasks of that saved roadmap step and, on `apply`, ticks the
  verified tasks in `app.user_task_progress` (they show `verified: true` in the roadmap view).
- Without `roadmapId` (the current mock roadmap page), the client sends `tasks: [{taskId, label, chunkIds}]`
  and ticks its own checklist after `apply`.
- Questions carry no answer key. `finish` must answer every question exactly once. A task is verified when
  all of its questions are right. `409 NO_CHECK_QUESTIONS` when no question matches the tasks.
- Finished results include `unassessedTasks: [{taskId, label}]` for tasks omitted because questions
  were unavailable or the eight-question limit was reached. Applying a result leaves those tasks unchanged.
- With `ASSESSMENT_AI_GENERATION=gemini`, tasks without questions get new ones written from their source
  before the response, so `POST /step-checks` can take up to about 20 seconds the first time
  ([question bank](question-bank.md)). The response shape does not change.

## Level check

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/level-checks` | `{skillId, entryPoint?}` | `201 {assessmentId, skill, hasQuiz, maxQuestions, statements}` |
| POST | `/{assessmentId}/self-check` | `{answers: {statementId: "yes" \| "unsure" \| "no"}}` | `{question}` or `{result}` (self-check only) |
| POST | `/{assessmentId}/answers` | `{itemId, choice}` | `{question}` or `{result}` |
| POST | `/{assessmentId}/decision` | `{decision: "accepted" \| "declined"}` | `{decision, profileLevel}` |

- The server holds the question queue. Answering any item other than the current one returns
  `409 ASSESSMENT_STATE_INVALID`. At most 9 questions (`staircase-v2`).
- `result`: `level`, `confidence` (high/medium/low), `method` (quiz/self_check), `note`, `selfCheckLevel`,
  `ladder` (per level: answers, status passed/not_passed/not_tested), `review` (answers with source quotes).
- `level` is null when no quiz level was passed; confidence is low and accepting the result returns
  `409 ASSESSMENT_STATE_INVALID`. The result can still be declined and remains in history.
- New short quiz results have at most medium confidence. Historical results keep their original scoring version.
- `accepted` writes the level into the profile (`proficiency_basis` `assessed` for a quiz,
  `self_reported` for a self-check). Accepted quiz evidence takes priority over self-ratings;
  the latest accepted result within that evidence type is used. `profileLevel` returns the effective
  profile value. Deciding twice returns 409.

## Quick question

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/quick` | `{skillId, level, answer, entryPoint?, stepKey?}` | `201 {assessmentId, decision, profileLevel}` |

A one-tap self rating (`level` beginner/intermediate/advanced). Kept immediately as `self_reported`.
It is retained in history without replacing an accepted quiz result for the same skill.

## Read one check

`GET /{assessmentId}` returns the finished result (step or level), or `{kind, status}` while in progress.

## Error codes

`PROFILE_NOT_FOUND` 404, `ASSESSMENT_NOT_FOUND` 404, `SKILL_NOT_FOUND` 404, `NO_CHECK_QUESTIONS` 409,
`ASSESSMENT_STATE_INVALID` 409, `INVALID_REQUEST` 400, `ROADMAP_NOT_FOUND` 404, `ASSESSMENT_UNAVAILABLE` 503.
