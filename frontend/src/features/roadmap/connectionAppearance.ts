import type { RoadmapConnection, RoadmapNodeStatus } from './type'

export const arrowColors: Record<RoadmapNodeStatus, string> = {
  completed: '#1e3a5f',
  'in-progress': '#64748b',
  upcoming: '#94a3b8',
}

export function isConnectionDashed(connection: RoadmapConnection, targetStatus: RoadmapNodeStatus): boolean {
  return targetStatus !== 'completed' && (targetStatus === 'upcoming' || Boolean(connection.optional))
}
