// Copy of shared/contracts/api/roadmap/roadmap.ts. Update both files together.
/**
 * Roadmap API types for the frontend. Source of truth: ai/roadmap/contracts.py
 * (roadmap-view.schema.json is generated from it). A copy lives in
 * frontend/src/features/roadmap/api-types.ts; keep field names unchanged.
 */

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'
export type StepProgressInput = Exclude<ProgressStatus, 'skipped'>
export type NodeKind = 'skill' | 'foundation-check' | 'foundation-context' | 'project' | 'career-activity' | 'goal'
export type TaskKind = 'learn' | 'practice' | 'check'
export type DeferReason =
  | 'OUTSIDE_TIME_BUDGET'
  | 'CONTENT_OUTLINE_ONLY'
  | 'LOW_MARKET_SIGNAL'
  | 'NEEDS_CONFIRMATION'

export type HoursRange = { min: number; max: number }

export type Citation = {
  chunkId: number
  title: string
  url: string | null
  heading: string | null
  /** Exact text from the source; show as a quote with a link to url. */
  quote: string
}

export type ChecklistItem = {
  /** "<nodeKey>.<n>"; use as taskId in the task progress endpoint. */
  id: string
  label: string
  detail: string
  taskKind: TaskKind
  completed: boolean
  citations: Citation[]
  /** Ticked by a step check (the learner answered its questions correctly). */
  verified: boolean
  /** A step check found this task worth reviewing. */
  needsReview: boolean
  /** Reviewed questions available for this task in a step check (0 = no check). */
  questionCount: number
}

export type SkillDetail = {
  title: string
  detail: string
  citations: Citation[]
}

export type ProfileEvidence = {
  evidenceType: string
  excerpt: string
}

export type NodeSkill = {
  skillId: number
  name: string
  currentLevel: string | null
  targetLevel: string | null
  gapStatus: string | null
  inProfile: boolean
  /**
   * Plain-language profile status, for example "Not in your profile yet". Show it where the
   * design has "Current confidence". No confidence percentage is calculated.
   */
  profileLabel: string
  /** Evidence extracted from the learner's CV or profile; separate from learning citations. */
  profileEvidence: ProfileEvidence[]
}

export type RoadmapNode = {
  key: string
  kind: NodeKind
  title: string
  /** Text under the title on the node card: "Completed", "In progress", "Upcoming project", ... */
  subtitle: string
  summary: string
  whyItMatters: string[]
  skill: NodeSkill | null
  estimatedHours: HoursRange | null
  dependsOn: string[]
  /** Dependency depth. Prefer position for drawing. */
  layer: number
  order: number
  /** Recommended learning sequence by market-gap priority; not a prerequisite. */
  recommendedOrder: number | null
  /** Canvas grid lines, starting at 1. column is 1-3; at most three nodes share a row. */
  position: { row: number; column: number }
  status: ProgressStatus
  learningContentAvailable: boolean
  contextOnly: boolean
  checklist: ChecklistItem[]
  details: SkillDetail[]
  /** Complete at roadmap creation because the skill is confirmed in the profile. */
  baselineComplete: boolean
  citations: Citation[]
  /** Show as an info banner when present, e.g. "learning content is not ready yet". */
  notice: string | null
}

export type RoadmapView = {
  roadmapId: number | null
  version: number | null
  status: 'draft' | 'active' | 'completed' | 'replaced' | 'archived'
  generatedAt: string
  generation: { provider: string; model: string; promptVersion: string; contextId: string; reused: boolean }
  summary: {
    title: string
    overview: string
    targetRole: string
    careerName: string
    readinessTimeframe: string | null
    targetDate: string | null
    weeklyAvailability: string | null
    learningStyle: string | null
    estimatedHours: HoursRange
    budgetHours: HoursRange | null
    /** Weekly hours from the saved availability, for "8-14 hours at 2-5 hrs/week". */
    weeklyHours: HoursRange | null
    /** Header text, e.g. "3 months". */
    durationLabel: string
    /** Sidebar text, e.g. "3 months remaining". Recalculated on every read. */
    timeRemainingLabel: string
    planningNote: string
    assumptions: string[]
  }
  /** "Best next step". Moves forward as steps are completed. */
  nextAction: { nodeKey: string; text: string }
  /** Node that gets the "You are here" badge: the first step in progress, else the next action. */
  currentNodeKey: string
  layout: { columns: number; rows: number }
  nodes: RoadmapNode[]
  /** optional: true is a recommended path that does not block the next step (dashed line). */
  edges: Array<{
    from: string
    to: string
    optional: boolean
    kind: 'prerequisite' | 'recommended_order' | 'related'
    relationships: Array<{
      dependencyId: number
      relationshipType: 'prerequisite' | 'recommended_before' | 'related'
      scopeType: 'general' | 'document_specific' | 'conditional'
      scopeNote: string | null
      sourceTitle: string | null
      sourceUrl: string | null
      evidenceQuote: string
    }>
  }>
  deferred: Array<{ skillId: number; skillName: string; reasonCode: DeferReason; note: string }>
  confirmations: Array<{ skillId: number; skillName: string; question: string }>
  contentNotices: Array<{ skillId: number; skillName: string; notice: string }>
  limitations: string[]
  /** Computed from completed tasks only. Never show it as job readiness. */
  progress: {
    completedSteps: number
    totalSteps: number
    completedTasks: number
    totalTasks: number
    percent: number
    /** Replaces "On track": for example "2 of 9 tasks done". */
    label: string
  }
}

export type CareerGoal = {
  goalId: number
  careerId: number
  careerProfileId: number
  targetRoleTitle: string
  readinessTimeframe: 'three_months' | 'six_months' | 'one_year' | 'no_fixed_deadline'
  targetDate: string | null
  weeklyAvailability: 'under_2_hours' | 'hours_2_to_5' | 'hours_5_to_10' | 'hours_10_plus'
  availableHoursPerWeek: number | null
  preferredLearningStyle: 'structured_courses' | 'hands_on_projects' | 'reading_articles' | 'videos_tutorials'
  additionalContext: string | null
  updatedAt: string
}

export type CareerGoalInput = Omit<CareerGoal, 'goalId' | 'careerId' | 'updatedAt' | 'targetRoleTitle'> & {
  targetRoleTitle?: string | null
}

/** Body of PUT .../steps/{stepKey}: "Start learning" = in_progress, "Mark as completed" = completed. */
export type StepStatusInput = { status: StepProgressInput }

export type RoadmapJob = {
  jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  stage: 'queued' | 'preparing' | 'generating' | 'saving' | 'done'
  roadmapId: number | null
  /** true when an identical request returned the saved roadmap without a new AI call. */
  reused: boolean
  error?: { code: RoadmapErrorCode; message: string; retryable: boolean }
}

export type RoadmapErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'GOAL_NOT_FOUND'
  | 'CAREER_PROFILE_NOT_FOUND'
  | 'KNOWLEDGE_NOT_READY'
  | 'ROADMAP_CONTEXT_FAILED'
  | 'ROADMAP_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'ROADMAP_LIMIT_REACHED'
  | 'ROADMAP_BUDGET_REACHED'
  | 'ROADMAP_UNAVAILABLE'
  | 'MODEL_REFUSAL'
  | 'MODEL_UNAVAILABLE'
  | 'ROADMAP_GENERATION_FAILED'
  | 'REPLAN_NOT_ELIGIBLE'
  | 'REPLAN_SKILL_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR'
