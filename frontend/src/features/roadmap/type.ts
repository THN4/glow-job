export type RoadmapNodeKind = 'skill' | 'project' | 'career-activity' | 'goal'

export type RoadmapNodeStatus = 'completed' | 'in-progress' | 'upcoming'

export type RoadmapEvidence = {
  id: string
  type: 'GitHub project' | 'Certificate' | 'Self report'
  title: string
  url?: string
  notes: string
  photo?: string
}

export type RoadmapNodePosition = {
  row: number
  column: number
}

export type RoadmapChecklistItem = {
  id: string
  label: string
  completed: boolean
  kind?: 'learn' | 'practice'
  sourceId?: string
  /** Ticked by a step check: the learner answered its questions correctly. */
  verified?: boolean
  /** A step check found this task worth reviewing. */
  needsReview?: boolean
}

export type RoadmapNodeData = {
  id: string
  /** Canonical core.skills ID used by document retrieval; never infer from the UI slug. */
  skillId?: number
  title: string
  kind: RoadmapNodeKind
  status: RoadmapNodeStatus
  /** False for a visible placeholder node whose reviewed learning content is not ready. */
  learningContentAvailable?: boolean
  baselineComplete?: boolean
  contextOnly?: boolean
  position: RoadmapNodePosition
  subtitle: string
  description: string
  whyItMatters: string[]
  unlockIds?: string[]
  checklist?: RoadmapChecklistItem[]
}

export type RoadmapConnection = {
  from: string
  to: string
  /** Dashed lines indicate a recommended/optional path. */
  optional?: boolean
  kind?: 'prerequisite' | 'recommended_order' | 'related'
  relationships?: Array<{
    dependencyId: number
    relationshipType: 'prerequisite' | 'recommended_before' | 'related'
    scopeType: 'general' | 'document_specific' | 'conditional'
    scopeNote: string | null
    sourceTitle: string | null
    sourceUrl: string | null
    evidenceQuote: string
  }>
  label?: string
}

export type RoadmapSummary = {
  goalTitle: string
  targetRole: string
  duration: string
  completion: number
  statusText: string
}
