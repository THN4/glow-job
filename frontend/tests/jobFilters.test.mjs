import assert from 'node:assert/strict'
import { test } from 'node:test'
import { jobFilterParams, readJobFilters } from '../src/features/applications/jobFilters.ts'

test('shared URLs round-trip filters and retain recommendation view', () => {
  const filters = { sort: 'recent', location: 'Bangkok & vicinity', employmentType: 'Full-time', skillId: '71' }
  const current = new URLSearchParams('tab=recommendations&view=jobs&tracking=keep')
  const next = jobFilterParams(filters, current)
  assert.deepEqual(readJobFilters(new URLSearchParams(next.toString())), filters)
  assert.equal(next.get('view'), 'jobs')
  assert.equal(next.get('tracking'), 'keep')
  assert.equal(current.has('location'), false)
  const apiParams = jobFilterParams(filters)
  assert.equal(apiParams.has('tab'), false)
})

test('invalid shared URL values do not become invalid API requests', () => {
  for (const skillId of ['SQL', '1.5', '-1', '0', '1e2', 'Infinity', '9007199254740993']) {
    assert.equal(readJobFilters(new URLSearchParams({ skillId })).skillId, '')
  }
  const filters = readJobFilters(new URLSearchParams({
    sort: 'bad', location: 'x'.repeat(301), employmentType: 'y'.repeat(101), skillId: '0071',
  }))
  assert.deepEqual(filters, { sort: 'semantic', location: '', employmentType: '', skillId: '71' })
})

test('clearing filters removes old query values and browser-back values remain recoverable', () => {
  const old = new URLSearchParams('tab=recommendations&view=jobs&sort=recent&location=Bangkok&skillId=71')
  const cleared = jobFilterParams({ sort: 'semantic', location: '', employmentType: '', skillId: '' }, old)
  assert.equal(cleared.toString(), 'tab=recommendations&view=jobs')
  assert.equal(readJobFilters(old).location, 'Bangkok')
  assert.equal(readJobFilters(cleared).location, '')
})

test('coverage sort remains explicit while Gemini knowledge similarity is the default', () => {
  assert.equal(readJobFilters(new URLSearchParams()).sort, 'semantic')
  const filters = { sort: 'coverage', location: '', employmentType: '', skillId: '' }
  assert.deepEqual(readJobFilters(jobFilterParams(filters)), filters)
})
