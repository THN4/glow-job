import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId } from '../resume/api'
import { assessmentsApi, overviewKey } from './api'

/** Stats, level checks, step-check summaries and activity for the saved profile. */
export function useAssessmentsOverview() {
  const hasProfile = Boolean(getSavedProfileId())
  const query = useQuery({
    queryKey: overviewKey(),
    queryFn: assessmentsApi.overview,
    enabled: hasProfile,
    retry: false,
    staleTime: 30_000,
  })
  return { ...query, hasProfile }
}
