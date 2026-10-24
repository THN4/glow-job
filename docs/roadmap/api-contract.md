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

### Re-plan after a saved application rejection

The application must belong to the signed-in profile, have status `rejected`, and
have rejection category `skill-gap`. The category and reason are recorded by the
user; they do not establish the employer's actual decision criteria. An existing
roadmap is required before creating a revised one.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profiles/{profileId}/applications/{applicationId}/replan-options` | none | `RejectionReplanOptions` |
| POST | `/profiles/{profileId}/roadmaps` | `{"rejectionApplicationId": 42, "focusSkillIds": [103]}` | `202 RoadmapJob` |
| GET | `/profiles/{profileId}/roadmaps/history` | none | `{"roadmaps": RoadmapHistoryEntry[]}` |
| GET | `/profiles/{profileId}/roadmaps/{roadmapId}` | none | `{"roadmap": RoadmapView}` |

The preview first matches explicit canonical skill names and catalog aliases in
the saved reason. For example, a reason containing `SQL` and `Python` proposes
those skills, including a skill completed in an earlier roadmap or confirmed in
the profile. It does not infer SQL from `JOIN` alone. If the reason contains no
recognized skill name, the preview returns no unrelated market suggestions;
the user can edit the reason. With an empty reason, the preview falls back to
at most 12 ranked market gaps; a linked posting narrows this fallback to its
saved required/preferred skills. `matchingMode` explains which path was used.
Each option includes `skillId`, `name`, `gapStatus`, nullable `priorityRank`,
`source`, `requirementType`, `alreadyPlanned`, `completedInRoadmap`, `inProfile`,
`alreadyCompleted`, and `learningContentAvailable`. The user selects one to
three distinct IDs with learning content. The server rechecks ownership,
rejection status, career goal, skill eligibility, and document availability when
the request starts and again when the queued job builds its Agent Context.
`force` cannot be combined with a rejection re-plan. No skill is added to the
user profile by this request.

The successful generation has reason `application_rejection`, stores the source
event in the Agent Context, and links the prior roadmap with
`previousRoadmapId`. The previous version is readable but cannot be edited.
Selected focus skills begin a new learning/review step; a previous completion
remains visible in the old version and is not copied into that step. Other
completed checklist items carry forward only when the canonical skill ID,
target level, task label, description, and kind match exactly. `RoadmapHistoryEntry`
includes `roadmapId`, `version`, `status`, `generationReason`,
`previousRoadmapId`, `generatedAt`, and `replanTrigger` (or `null`). The trigger
contains `kind`, `application_id`, `job_title`, `rejection_category`,
`reason_summary`, `focus_skill_ids`, `review_skill_ids`, and `source`.

### Demo re-plan from market snapshot

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profiles/{profileId}/market-replan-options` | none | `MarketReplanOptions` |
| POST | `/profiles/{profileId}/roadmaps` | `{"marketFocusSkillIds": [103]}` | `202 RoadmapJob` |

The market preview uses the active Agent Context's saved career market snapshot
and returns skills not already represented in the active roadmap. Each option
includes the observed demand count, percentage, snapshot date range, current gap
status, `alreadyInAgentContext`, `learningContentAvailable`, and an `alertDetail`
story. The sidebar's **News alerts** card links directly to the preselected story.
The UI labels it as a **Demo**: one snapshot can show frequency, but cannot establish
that demand is rising or that a skill is newly trending.

The user selects one skill, whether or not learning documents are currently
available. If the skill already exists in the saved Agent Context, its reviewed
evidence is reused. Otherwise the backend retrieves and reviews evidence only for
that selected skill, then appends its candidate, citations, and verified foundation
links to a copy of the existing context. The user's saved profile, market
assessments, scores, and existing candidates remain from the prior snapshot. If no
reviewed teaching evidence exists, the selected skill can still appear in the new
Roadmap as a placeholder explaining that content is not ready. The backend
revalidates the skill and market window when the queued job starts. The trigger is
saved as `market_update` with `is_demo`, `market_window`, `source`, and selected
focus IDs. It does not change the user profile, market statistics, or match score.
Matching progress carries forward only when canonical skill ID, target level, and
checklist item details match the prior version.

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
