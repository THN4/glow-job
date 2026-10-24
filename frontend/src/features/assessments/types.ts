/** Assessments API types. Source of truth: backend/app/features/assessments/service.py. */

export type Level = 'beginner' | 'intermediate' | 'advanced'
export type EntryPoint = 'roadmap' | 'assessments' | 'skill_profile'
export type Decision = 'pending' | 'accepted' | 'declined'

export type StepTask = { taskId: string; label: string; chunkIds: number[] }

export type Question = {
  itemId: number
  stem: string
  options: string[]
  /** Level checks only. */
  number?: number
  maxQuestions?: number
  /** Step checks only. */
  taskId?: string
  taskLabel?: string
}

export type AnswerReview = {
  itemId: number
  stem: string
  options: string[]
  choice: number | null
  correct: boolean
  answerIndex: number
  quote: string
  source: { title: string; heading: string | null; url: string | null }
}

export type StepCheckStart = { assessmentId: number; stepKey: string; taskCount: number; questions: Question[] }

export type StepCheckResult = {
  unassessedTasks: Array<{ taskId: string; label: string }>
  assessmentId: number
  stepKey: string
  decision: Decision
  verifiedCount: number
  taskCount: number
  tasks: Array<{ taskId: string; label: string; verified: boolean; questions: AnswerReview[] }>
}

export type StepCheckApplied = { decision: Decision; verifiedTaskIds: string[]; reviewTaskIds: string[] }

export type Statement = { id: number; level: Level; text: string }

export type LevelCheckStart = {
  assessmentId: number
  skill: { skillId: number; name: string }
  hasQuiz: boolean
  maxQuestions: number
  statements: Statement[]
}

export type LevelResult = {
  assessmentId: number
  skill: { skillId: number; name: string }
  level: Level | null
  confidence: 'high' | 'medium' | 'low'
  method: 'quiz' | 'self_check'
  note: string
  selfCheckLevel: Level
  asked: number
  correct: number
  ladder: Array<{ level: Level; asked: number; correct: number; answers: boolean[]; status: 'passed' | 'not_passed' | 'not_tested' }>
  review: AnswerReview[]
  decision: Decision
}

export type LevelStep = { assessmentId: number; question?: Question; result?: LevelResult }

export type LevelCheckTarget = {
  skillId: number
  name: string
  inProfile: boolean
  level: Level | 'expert' | null
  basis: string | null
  hasQuiz: boolean
  reason: string
}

export type ActivityEntry = {
  assessmentId: number
  kind: 'step_check' | 'level_check' | 'quick_question'
  skillId: number | null
  skillName: string | null
  stepKey: string | null
  text: string
  decision: Decision
  at: string | null
}

export type StepCheckSummary = {
  stepKey: string
  roadmapId: number | null
  assessmentId: number
  verified: number
  taskCount: number
  decision: Decision
  completedAt: string | null
  verifiedTaskIds: string[]
  reviewTaskIds: string[]
}

export type AssessmentsOverview = {
  stats: { verifiedTasks: number; skillsWithLevel: number; profileSkills: number }
  levelChecks: LevelCheckTarget[]
  stepChecks: StepCheckSummary[]
  activity: ActivityEntry[]
}
