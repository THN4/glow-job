export type RoadmapNodeKind = 'skill' | 'project' | 'career-activity' | 'goal'

export type RoadmapNodeStatus = 'completed' | 'in-progress' | 'upcoming'

export type RoadmapNodePosition = {
  row: number
  column: number
}

export type RoadmapChecklistItem = {
  id: string
  label: string
  completed: boolean
}

export type RoadmapNodeData = {
  id: string
  title: string
  kind: RoadmapNodeKind
  status: RoadmapNodeStatus
  baselineComplete?: boolean
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
}

export type RoadmapSummary = {
  goalTitle: string
  targetRole: string
  duration: string
  completion: number
  statusText: string
}
