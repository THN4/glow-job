import { recordRoadmapActivity } from '../roadmap/activity'
import type { RoadmapNodeData } from '../roadmap/type'

/** Show an applied step check in the roadmap's Recent activity feed. */
export function recordStepCheckActivity(node: Pick<RoadmapNodeData, 'id' | 'title'>, verified: number, review: number): void {
  recordRoadmapActivity({
    kind: 'checklist',
    title: `Step check in ${node.title}`,
    description: review ? `${verified} study task${verified === 1 ? '' : 's'} verified, ${review} to review.`
      : `${verified} study task${verified === 1 ? '' : 's'} verified.`,
    nodeId: node.id,
  })
}
