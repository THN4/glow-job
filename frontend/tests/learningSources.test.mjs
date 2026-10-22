import assert from 'node:assert/strict'
import test from 'node:test'
import { adaptLearningSources, createLearningSourcesLoader, safeSourceUrl } from '../src/features/roadmap/learningSources.ts'

function preview(status = 'supported') {
  return {
    schema_version: 'knowledge-context-preview-1',
    skills: [{
      skill_id: 7, status,
      retrieved_context: [
        { chunk_id: 1, source_id: 2, title: 'Workflow tutorial', source_url: 'https://example.com/tutorial', heading_path: ['Tasks'], content: 'Tasks perform units of work in a workflow.' },
        { chunk_id: 3, source_id: 2, title: 'Uncited material', source_url: null, heading_path: [], content: 'Not cited.' },
      ],
      claims: [{ citations: [{ chunk_id: 1, quote: 'Tasks perform units of work' }] }],
    }],
  }
}

test('maps only cited chunks, preserving exact excerpts and headings', () => {
  const result = adaptLearningSources(preview(), 7)
  assert.equal(result.sources.length, 1)
  assert.deepEqual(result.sources[0].excerpts, ['Tasks perform units of work'])
  assert.deepEqual(result.sources[0].headingPath, ['Tasks'])
})

test('rejects unrelated skills, malformed payloads and unsupported schema versions', () => {
  assert.throws(() => adaptLearningSources(preview(), 9))
  assert.throws(() => adaptLearningSources({}, 7))
  assert.throws(() => adaptLearningSources({ ...preview(), schema_version: 'other' }, 7))
})

test('does not present unreviewed or unsupported content as study materials', () => {
  for (const status of ['not_reviewed', 'insufficient_evidence', 'error']) {
    assert.deepEqual(adaptLearningSources(preview(status), 7), { status, sources: [] })
  }
  assert.equal(adaptLearningSources(preview('partial'), 7).status, 'partial')
})

test('drops excerpts absent from the chunk rather than inventing a citation', () => {
  const data = preview()
  data.skills[0].claims[0].citations[0].quote = 'Unsupported quote'
  assert.deepEqual(adaptLearningSources(data, 7), { status: 'insufficient_evidence', sources: [] })
})

test('handles missing links and blocks unsafe URL schemes', () => {
  for (const url of [null, 'javascript:alert(1)', 'data:text/html,example', '/relative']) {
    assert.equal(safeSourceUrl(url), undefined)
  }
  const data = preview()
  data.skills[0].retrieved_context[0].source_url = null
  assert.equal(adaptLearningSources(data, 7).sources[0].url, undefined)
})

test('loader passes the canonical skill and cancellation signal to the endpoint', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/configured-learning-endpoint')
    assert.equal(options.signal, controller.signal)
    assert.deepEqual(JSON.parse(options.body), { skill_ids: [7], intent: 'fundamentals' })
    return { ok: true, json: async () => preview() }
  })
  const result = await createLearningSourcesLoader('/configured-learning-endpoint')(7, controller.signal)
  assert.equal(result.sources.length, 1)
})

test('loader reports HTTP failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  await assert.rejects(createLearningSourcesLoader('/configured-learning-endpoint')(7, new AbortController().signal))
})
