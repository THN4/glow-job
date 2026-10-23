import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId } from '../resume/api'
import { loadCurrentRoadmap } from './api'

export const currentRoadmapKey = (profileId: string | null) => ['roadmap', 'current', profileId] as const

/** Shared saved-roadmap query for the Overview and workspace sidebar. */
export function useCurrentRoadmap() {
  const profileId = getSavedProfileId()
  return useQuery({
    queryKey: currentRoadmapKey(profileId),
    queryFn: ({ signal }) => loadCurrentRoadmap(signal),
    enabled: Boolean(profileId),
  })
}
