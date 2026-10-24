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
  'foundation-context': 'skill',
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
  profileEvidence: NonNullable<ApiNode['skill']>['profileEvidence']
  notice: string | null
  citations: ApiNode['citations']
  tasks: Array<{ id: string; detail: string; taskKind: ApiNode['checklist'][number]['taskKind']; citations: ApiNode['citations'] }>
  details: ApiNode['details']
}

export type RoadmapScreenData = {
  nodes: RoadmapNodeData[]
  /** Simple visual learning path; does not define which steps are unlocked. */
  connections: RoadmapConnection[]
  /** Reviewed prerequisites used for start/completion gating and detail display. */
  dependencies: RoadmapConnection[]
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
  const progressNodes = view.nodes.filter((node) => node.kind !== 'goal' && !node.contextOnly)
  const completedNodes = progressNodes.filter((node) => node.status === 'completed').length
  const totalNodes = progressNodes.length
  const completion = totalNodes ? Math.round((completedNodes / totalNodes) * 100) : 0
  const statusText = `${completedNodes} of ${totalNodes} tasks completed`
  const nodes: RoadmapNodeData[] = view.nodes.map((node) => ({
    id: node.key,
    skillId: node.skill?.skillId,
    title: node.kind === 'skill' && node.skill ? node.skill.name : node.title,
    kind: KIND[node.kind],
    status: STATUS[node.status],
    learningContentAvailable: node.learningContentAvailable,
    contextOnly: node.contextOnly,
    baselineComplete: node.baselineComplete,
    position: node.position,
    subtitle: node.subtitle,
    description: node.summary,
    whyItMatters: node.whyItMatters,
    unlockIds: view.edges.filter((edge) => edge.kind === 'prerequisite' && edge.from === node.key).map((edge) => edge.to),
    checklist: node.checklist.map((item) => ({ id: item.id, label: item.label, completed: item.completed })),
  }))

  const extras: Record<string, RoadmapNodeExtra> = {}
  for (const node of view.nodes) {
    extras[node.key] = {
      timeText: timeText(node, weekly),
      profileLabel: node.skill?.profileLabel ?? null,
      profileEvidence: node.skill?.profileEvidence ?? [],
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

  // Draw true prerequisites and suggested links into portfolio/career steps.
  // Rank-only skill-to-skill hints and direct-to-goal joins are left out to keep the graph clear.
  const nodeKindById = new Map(nodes.map((node) => [node.id, node.kind]))
  const connections: RoadmapConnection[] = view.edges
    .filter((edge) => edge.kind === 'prerequisite'
      || edge.kind === 'related'
      || edge.relationships.length > 0
      || (edge.kind === 'recommended_order'
        && (['project', 'career-activity'].includes(nodeKindById.get(edge.to) ?? '')
          || (edge.to === 'goal'
            && ['project', 'career-activity'].includes(nodeKindById.get(edge.from) ?? '')))))
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      optional: edge.optional,
      kind: edge.kind,
      relationships: edge.relationships,
      label: edge.relationships.length > 1
        ? `${edge.relationships.length} reviewed links`
        : edge.relationships[0]?.relationshipType === 'related' ? 'Related'
        : edge.relationships[0]?.relationshipType === 'prerequisite'
          ? edge.optional ? 'Conditional prerequisite' : 'Prerequisite'
        : edge.relationships[0]?.relationshipType === 'recommended_before' ? 'Recommended before'
        : edge.kind === 'related' ? 'Related'
        : edge.kind === 'prerequisite'
        ? edge.optional ? 'Optional foundation' : 'Required first'
        : nodeKindById.get(edge.to) === 'project' ? 'Practice in project'
          : nodeKindById.get(edge.to) === 'career-activity' ? 'Career step' : 'Career outcome',
    }))
  const dependencies: RoadmapConnection[] = view.edges
    .filter((edge) => !edge.optional && edge.kind === 'prerequisite')
    .map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind }))

  return {
    nodes,
    connections,
    dependencies,
    summary: {
      goalTitle: view.summary.careerName,
      targetRole: view.summary.targetRole,
      duration: view.summary.durationLabel,
      completion,
      statusText,
    },
    goal: {
      title: view.summary.targetRole,
      progress: completion,
      statusText,
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
