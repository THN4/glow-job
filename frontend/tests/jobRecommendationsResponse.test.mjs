import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseJobRecommendationsResponse } from '../src/features/applications/jobRecommendationsResponse.ts'

const response = {
  targetRole: null, policy: 'test', hasConfirmedSkills: true,
  recommendations: [], limitations: [], totalCandidates: 137,
  unscoredPostings: 20, totalMatched: 30, filteredCount: 0, returnedCount: 0,
  filterOptions: { locations: ['Bangkok'], employmentTypes: [], skills: [{ skillId: 1, name: 'Python' }] },
}

test('old backend responses become a recoverable query error before rendering', () => {
  const { filterOptions, ...old } = response
  assert.ok(filterOptions)
  for (const invalid of [old, null, { ...response, filterOptions: null },
    { ...response, filterOptions: { locations: null } }]) {
    assert.throws(() => parseJobRecommendationsResponse(invalid), /restart the backend/)
  }
})

test('valid empty matches retain global filter options and counts', () => {
  assert.equal(parseJobRecommendationsResponse(response), response)
})

test('missing counts and invalid dropdown entries are rejected', () => {
  assert.throws(() => parseJobRecommendationsResponse({ ...response, totalMatched: undefined }))
  assert.throws(() => parseJobRecommendationsResponse({ ...response, returnedCount: 30 }))
  assert.throws(() => parseJobRecommendationsResponse({
    ...response, filterOptions: { ...response.filterOptions, skills: [{ name: 'Python' }] },
  }))
})
