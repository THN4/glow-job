import type {
  CurrentGoalSummary,
} from '../workspace/type'
import type {
  HoursRange,
  RoadmapNode as ApiNode,
  RoadmapView,
} from './api-types'
import type {
  RoadmapConnection,
  RoadmapNodeData,
  RoadmapNodeKind,
  RoadmapNodeStatus,
  RoadmapSummary,
} from './type'

/**
 * Turns the Roadmap API response into the shapes the existing Roadmap components already take
 * (RoadmapNodeData, RoadmapConnection, RoadmapSummary). Nothing here calls the API.
 */

const STATUS: Record<ApiNode['status'], RoadmapNodeStatus> = {
  not_started: 'upcoming',
  in_progress: 'in-progress',
  completed: 'completed',
  skipped: 'upcoming',
}

// The canvas has no separate style for a foundation check, so it is drawn as a skill.
const KIND: Record<ApiNode['kind'], RoadmapNodeKind> = {
  skill: 'skill',
  'foundation-check': 'skill',
  project: 'project',
  'career-activity': 'career-activity',
  goal: 'goal',
}

/** Extra facts the current detail panel has no field for yet. Keyed by node id. */
export type RoadmapNodeExtra = {
  /** "8 to 14 hours · at 2 to 5 hrs/week", or null for the goal node. */
  timeText: string | null
  /** Replaces "Current confidence": for example "Not in your profile yet". */
  profileLabel: string | null
  notice: string | null
  citations: ApiNode['citations']
  tasks: Array<{ id: string; detail: string; taskKind: ApiNode['checklist'][number]['taskKind']; citations: ApiNode['citations'] }>
  details: ApiNode['details']
}

export type RoadmapScreenData = {
  nodes: RoadmapNodeData[]
  connections: RoadmapConnection[]
  summary: RoadmapSummary
  /** Header card in the workspace sidebar. */
  goal: CurrentGoalSummary
  /** Node that shows the "You are here" badge. */
  currentNodeId: string
  /** Node that shows the "Best next step" badge. */
  nextNodeId: string
  nextActionText: string
  /** Grid size the canvas must provide. */
  layout: RoadmapView['layout']
  extras: Record<string, RoadmapNodeExtra>
  deferred: RoadmapView['deferred']
  confirmations: RoadmapView['confirmations']
  contentNotices: RoadmapView['contentNotices']
  limitations: string[]
}

function range(value: HoursRange, unit = 'hours'): string {
  return value.min === value.max ? `${value.min} ${unit}` : `${value.min} to ${value.max} ${unit}`
}

export function timeText(node: ApiNode, weekly: HoursRange | null): string | null {
  if (!node.estimatedHours) return null
  const hours = range(node.estimatedHours)
  return weekly ? `${hours} · at ${range(weekly, 'hrs/week')}` : hours
}

export function toRoadmapScreen(view: RoadmapView): RoadmapScreenData {
  const weekly = view.summary.weeklyHours
  const nodes: RoadmapNodeData[] = view.nodes.map((node) => ({
    id: node.key,
    title: node.kind === 'skill' && node.skill ? node.skill.name : node.title,
    kind: KIND[node.kind],
    status: STATUS[node.status],
    baselineComplete: node.baselineComplete,
    position: node.position,
    subtitle: node.subtitle,
    description: node.summary,
    whyItMatters: node.whyItMatters,
    unlockIds: view.edges.filter((edge) => edge.from === node.key).map((edge) => edge.to),
    checklist: node.checklist.map((item) => ({ id: item.id, label: item.label, completed: item.completed })),
  }))

  const extras: Record<string, RoadmapNodeExtra> = {}
  for (const node of view.nodes) {
    extras[node.key] = {
      timeText: timeText(node, weekly),
      profileLabel: node.skill?.profileLabel ?? null,
      notice: node.notice,
      citations: node.citations,
      tasks: node.checklist.map((item) => ({
        id: item.id,
        detail: item.detail,
        taskKind: item.taskKind,
        citations: item.citations,
      })),
      details: node.details,
    }
  }

  return {
    nodes,
    connections: view.edges.map((edge) => ({ from: edge.from, to: edge.to, optional: edge.optional || undefined })),
    summary: {
      goalTitle: view.summary.careerName,
      targetRole: view.summary.targetRole,
      duration: view.summary.durationLabel,
      completion: view.progress.percent,
      statusText: view.progress.label,
    },
    goal: {
      title: view.summary.targetRole,
      progress: view.progress.percent,
      statusText: view.progress.label,
      timeRemaining: view.summary.timeRemainingLabel,
    },
    currentNodeId: view.currentNodeKey,
    nextNodeId: view.nextAction.nodeKey,
    nextActionText: view.nextAction.text,
    layout: view.layout,
    extras,
    deferred: view.deferred,
    confirmations: view.confirmations,
    contentNotices: view.contentNotices,
    limitations: view.limitations,
  }
}
