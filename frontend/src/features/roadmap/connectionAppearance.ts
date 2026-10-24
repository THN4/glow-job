import type { RoadmapConnection, RoadmapNodeStatus } from './type'

export const arrowColors: Record<RoadmapNodeStatus, string> = {
  completed: '#1e3a5f',
  'in-progress': '#64748b',
  upcoming: '#94a3b8',
}

export function isConnectionDashed(connection: RoadmapConnection, targetStatus: RoadmapNodeStatus): boolean
export function isConnectionDashed(
  connection: RoadmapConnection,
  sourceStatus: RoadmapNodeStatus,
  targetStatus: RoadmapNodeStatus,
): boolean
export function isConnectionDashed(
  connection: RoadmapConnection,
  sourceOrTargetStatus: RoadmapNodeStatus,
  maybeTargetStatus?: RoadmapNodeStatus,
): boolean {
  // Keep existing callers that only know the target status behaving as before.
  if (!maybeTargetStatus) {
    return sourceOrTargetStatus !== 'completed'
      && (sourceOrTargetStatus === 'upcoming' || Boolean(connection.optional))
  }
  const sourceStatus = sourceOrTargetStatus
  const targetStatus = maybeTargetStatus
  if (sourceStatus === 'completed' && targetStatus === 'completed') return false
  if (connection.optional || connection.kind === 'recommended_order') return true
  return sourceStatus !== 'completed' || targetStatus !== 'completed'
}
