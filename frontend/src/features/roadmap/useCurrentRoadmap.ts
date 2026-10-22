import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId, getSessionId } from '../resume/api'
import { loadCurrentRoadmap } from './api'

/** Shared server state for the canvas and the workspace goal card. */
export function useCurrentRoadmap() {
  return useQuery({
    queryKey: ['current-roadmap', getSessionId(), getSavedProfileId()],
    queryFn: ({ signal }) => loadCurrentRoadmap(signal),
    staleTime: 30_000,
  })
}
