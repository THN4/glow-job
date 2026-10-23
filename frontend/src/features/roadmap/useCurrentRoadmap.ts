import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId, getSessionId } from '../resume/api'
import { loadCurrentRoadmap } from './api'

export const currentRoadmapKey = (profileId: string | null) => ['current-roadmap', getSessionId(), profileId] as const

/** Shared saved roadmap for Overview, Skill Profile, Progress, canvas and sidebar. */
export function useCurrentRoadmap() {
  const profileId = getSavedProfileId()
  return useQuery({
    queryKey: currentRoadmapKey(profileId),
    queryFn: ({ signal }) => loadCurrentRoadmap(signal),
  })
}
