import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId, getSessionId } from '../resume/api'
import { loadRoadmapGoal } from './api'

export function useCareerGoal() {
  return useQuery({
    queryKey: ['career-goal', getSessionId(), getSavedProfileId()],
    queryFn: ({ signal }) => loadRoadmapGoal(signal),
    enabled: Boolean(getSavedProfileId()),
  })
}
