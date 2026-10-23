# Roadmap API contract

Base URL: `http://localhost:8787/api`. Every request needs `X-Session-Id`, the anonymous
session that saved the profile (`getSessionId()` in `frontend/src/features/resume/api.ts`).
Errors use the same envelope as the CV API: `{"error": {"code", "message", "retryable"}}`.

Types: [shared/contracts/api/roadmap/roadmap.ts](../../shared/contracts/api/roadmap/roadmap.ts).
Examples for every state: [shared/contracts/api/roadmap/examples/](../../shared/contracts/api/roadmap/examples/).

## Career goal

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profiles/{profileId}/goal` | none | `{"goal": CareerGoal \| null}` |
| PUT | `/profiles/{profileId}/goal` | `CareerGoalInput` | `{"goal": CareerGoal}` |

`careerProfileId` comes from `GET /career-profiles`. `targetRoleTitle` defaults to the
career name. `targetDate` must be in the future. Each user has one primary goal, and PUT
updates it. For a legacy saved goal with no `careerProfileId`, the backend resolves the
career only when `targetRoleTitle` exactly matches one active career profile name after
trimming whitespace and ignoring case. Custom or ambiguous titles remain unresolved; save
the goal again with an explicit `careerProfileId` to link them.

## Generate a roadmap

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/profiles/{profileId}/roadmaps` | `{"force": false}` (optional) | `202 RoadmapJob` |
| GET | `/roadmap-jobs/{jobId}` | none | `RoadmapJob` |

Poll the job every 2 seconds until `status` is `succeeded` or `failed`, then load the
current roadmap. A real model call takes about 30-120 seconds; the mock returns at once.

- `reused: true`: the inputs were identical to the active roadmap, so it was returned
  without a new roadmap model call. The current backend still builds RAG context before
  this check, so embedding and review calls may still happen. Use `force: true` only
  for an explicit "Regenerate" action.
- Stages: `queued` -> `preparing` -> `generating` -> `saving` -> `done`.

Errors returned by POST: `GOAL_NOT_FOUND` (409), `ROADMAP_LIMIT_REACHED` (429),
`ROADMAP_BUDGET_REACHED` (429), `PROFILE_NOT_FOUND` (404), `ROADMAP_UNAVAILABLE` (503).
Errors reported on a failed job: `KNOWLEDGE_NOT_READY`, `ROADMAP_CONTEXT_FAILED`,
`GOAL_NOT_FOUND`, `MODEL_REFUSAL`, `MODEL_UNAVAILABLE` (retryable),
`ROADMAP_GENERATION_FAILED` (retryable).

## Read and update progress

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profiles/{profileId}/roadmaps/current` | none | `{"roadmap": RoadmapView}` or 404 `ROADMAP_NOT_FOUND` |
| PUT | `/profiles/{profileId}/roadmaps/{roadmapId}/tasks/{taskId}` | `{"completed": true}` | `{"roadmap": RoadmapView}` |
| PUT | `/profiles/{profileId}/roadmaps/{roadmapId}/steps/{stepKey}` | `{"status": "in_progress"}` | `{"roadmap": RoadmapView}` |

`taskId` is `ChecklistItem.id` (for example `apache-airflow.2`). A task can only be changed
after its step has been started. Node status and `progress` are recomputed from saved tasks and
explicit step confirmation. A node with all tasks done remains `in_progress` until confirmed.
Profile-confirmed skills that already meet the
market target have `baselineComplete: true` and `status: "completed"` at creation; they are
not counted in learning-task progress and cannot be changed through the step endpoint.

The step endpoint is for whole-step buttons. `stepKey` is `RoadmapNode.key` (the goal node
is not a step and returns `TASK_NOT_FOUND`).

| `status` | Effect | Button in the design |
|---|---|---|
| `in_progress` | Marks the step started when all required incoming dependencies are completed. Tasks are unchanged. | Start learning |
| `completed` | Confirms completion only when the step is in progress and every checklist task is already complete. | Confirm completion |
| `not_started` | Clears every task and the started mark. | Reset |

A step the learner started stays `in_progress` when they untick its tasks. Reset it with
`not_started`. Independent steps without required incoming dependencies can be started in any
order. Optional edges are recommendations and do not lock a step.

## Skill evidence

All routes require the same profile-owning `X-Session-Id` header. User-added
evidence is stored separately from CV-extracted and assessment evidence.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profiles/{profileId}/skill-evidence` | none | `{"evidence": SkillEvidence[]}` |
| POST | `/profiles/{profileId}/skills/{skillId}/evidence` | evidence type, title, optional URL, notes, optional small image data URL | `201 {"evidence": SkillEvidence}` |
| DELETE | `/profiles/{profileId}/skill-evidence/{evidenceId}` | none | `{"deleted": true}` |

Evidence types are `github_project`, `certificate`, and `self_report`. Project
links must use HTTP(S); certificates need a link or image; self reports need
notes. Images are PNG, JPEG, or WebP data URLs up to 500 KB. Records are scoped
to the signed-in anonymous profile owner and canonical skill catalog.

The table is created by host migration `020_skill_profile_evidence.sql`.
Apply it with `python -m scripts.database.migrate` before using these endpoints.

## Rendering rules

The fields below were shaped to the Figma Roadmap frames. See
[frontend-handoff.md](frontend-handoff.md) for the element-by-element mapping.

- Canvas position: `position` has `row` (1 to `layout.rows`) and `column` (1 to 3),
  matching the three-column canvas. Straight chains snake across rows; branch and merge nodes
  receive their own row, and the goal is in the last
  row. `layer` and `order` are the raw dependency depth if a different layout is wanted.
- Draw `edges` from `from` to `to`. Skill prerequisite edges represent explicit `depends_on`
  relationships; market rank does not connect independent skills. A required edge is dashed until
  both nodes are complete, then solid. Optional recommendations remain dashed and do not block a step.
  The last node is always `kind: "goal"`.
- `subtitle` is the text under the node title. It changes with progress ("Upcoming", "In
  progress", "Completed", "Upcoming project", "Career activity", "Quick check"). The goal node shows
  "Target: <date>" or "Target: <timeframe>".
- "You are here" badge: `currentNodeKey`. "Best next step" badge: `nextAction.nodeKey`. The next
  action moves forward after explicit step completion.
- Header and sidebar text: `summary.targetRole`, `summary.durationLabel` ("3 months"),
  `summary.timeRemainingLabel` ("12 weeks remaining" or "3 months remaining"; recalculated on every read),
  `progress.percent` and `progress.label` ("2 of 9 tasks done").
- Estimated time: `estimatedHours` with `summary.weeklyHours`, for example "8 to 14 hours at
  2 to 5 hrs/week".
- Checklist items carry `verified` (ticked by a step check), `needsReview` (a step check failed it) and
  `questionCount` (reviewed questions for the task, 0 = no step check). Step checks themselves are in the
  [assessments API](../assessments/api-contract.md).
- In the detail panel, show `skill.profileLabel` ("Not in your profile yet") where the design
  has "Current confidence". No confidence percentage exists.
- For `baselineComplete: true`, show `details[]` as read-only skill topics, show source citations,
  and hide progress controls. These represent confirmed profile skills that meet the market target.
- Show `citations` as source links with the quote. Do not show a source that is not in
  the response.
- `progress.percent` is task completion only. Never label it as job readiness.
- Show `limitations`, `deferred` ("Next roadmap"), `confirmations` and
  `contentNotices` near the roadmap. They explain what the plan does not cover.
