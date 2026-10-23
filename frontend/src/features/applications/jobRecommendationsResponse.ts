import type { JobRecommendationsResponse } from './type'

/** Validate version-dependent fields before React renders filter controls. */
export function parseJobRecommendationsResponse(value: unknown): JobRecommendationsResponse {
  const fail = () => { throw new Error('Job matching returned incomplete filter data. Please update or restart the backend, then try again.') }
  if (!value || typeof value !== 'object') return fail()
  const data = value as Record<string, unknown>
  const options = data.filterOptions as Record<string, unknown> | null | undefined
  const strings = (items: unknown): items is string[] => Array.isArray(items) && items.every((item) => typeof item === 'string')
  if (!options || !strings(options.locations) || !strings(options.employmentTypes)
    || !Array.isArray(options.skills) || !options.skills.every((skill) =>
      skill && Number.isSafeInteger(skill.skillId) && skill.skillId > 0 && typeof skill.name === 'string')
    || !Array.isArray(data.recommendations) || !strings(data.limitations)) return fail()
  for (const field of ['totalCandidates', 'unscoredPostings', 'totalMatched', 'filteredCount', 'returnedCount']) {
    if (!Number.isSafeInteger(data[field]) || (data[field] as number) < 0) return fail()
  }
  const result = value as JobRecommendationsResponse
  if (result.returnedCount !== result.recommendations.length
    || result.returnedCount > result.filteredCount || result.filteredCount > result.totalMatched
    || result.totalMatched > result.totalCandidates || result.unscoredPostings > result.totalCandidates) return fail()
  return result
}
