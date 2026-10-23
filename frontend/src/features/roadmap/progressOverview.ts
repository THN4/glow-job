import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId, getSessionId } from '../resume/api'
import { loadProgressOverview } from './api'

export type ProgressActivity = {
  id: string
  kind: 'goal' | 'replan' | 'completed' | 'evidence' | 'assessment'
  title: string
  description: string
  nodeKey: string | null
  occurredAt: string
  roadmapId: number | null
}

export type ProgressOverview = {
  skillsInProfile: number
  evidenceItems: number
  lastAnalysedAt: string | null
  profileChangedSinceAnalysis: boolean
  marketUpdatedAt: string | null
  marketScanAgeDays: number | null
  activities: ProgressActivity[]
}

export function useProgressOverview() {
  return useQuery({
    queryKey: ['progress-overview', getSessionId(), getSavedProfileId()],
    queryFn: ({ signal }) => loadProgressOverview(signal),
    enabled: Boolean(getSavedProfileId()),
  })
}
