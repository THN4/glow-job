// Run: node --experimental-vm-modules --test scripts/tests/roadmapPolling.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const ts = require('typescript')
const source = await readFile(new URL('../../frontend/src/features/roadmap/api.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} })

async function harness({ finishesAt, failure = false }) {
  let elapsed = 0
  let starts = 0
  const stages = []
  const roadmap = { roadmapId: 28, nodes: [] }
  const job = (status = 'running') => ({ jobId: 'job-test', status, stage: status === 'running' ? 'preparing' : 'done',
    ...(failure ? { error: { message: 'Provider failed' } } : {}) })
  const context = vm.createContext({
    Date: class extends Date { static now() { return elapsed } },
    DOMException,
    window: { setTimeout(callback, delay) { elapsed += delay; queueMicrotask(callback); return 1 }, clearTimeout() {} },
    fetch: async (url, init = {}) => {
      let body
      if (init.method === 'POST') { starts++; body = job() }
      else if (url.endsWith('/roadmaps/current')) body = { roadmap }
      else body = job(elapsed >= finishesAt ? (failure ? 'failed' : 'succeeded') : 'running')
      return { ok: true, json: async () => body }
    },
  })
  const resume = new vm.SyntheticModule(['getSavedProfileId', 'getSessionId', 'loadCareerProfiles', 'saveCareerGoal'], function () {
    this.setExport('getSavedProfileId', () => 'profile-test')
    this.setExport('getSessionId', () => 'session-test')
    this.setExport('loadCareerProfiles', async () => [])
    this.setExport('saveCareerGoal', async () => {})
  }, { context })
  const module = new vm.SourceTextModule(outputText, { context, initializeImportMeta(meta) { meta.env = {} } })
  await module.link(() => resume)
  await module.evaluate()
  return {
    run: () => module.namespace.generateRoadmap(stage => stages.push(stage)),
    elapsed: () => elapsed, starts: () => starts, roadmap, stages,
  }
}

test('waits for a 334-second job without starting another generation', async () => {
  const api = await harness({ finishesAt: 334_000 })
  assert.deepEqual(await api.run(), api.roadmap)
  assert.equal(api.starts(), 1)
  assert.equal(api.elapsed(), 334_000)
  assert.equal(api.stages.at(-1), 'done')
})

test('accepts success returned at the final polling deadline', async () => {
  const api = await harness({ finishesAt: 900_000 })
  assert.deepEqual(await api.run(), api.roadmap)
})

test('still reports a backend failure after five minutes', async () => {
  const api = await harness({ finishesAt: 334_000, failure: true })
  await assert.rejects(api.run(), /Provider failed/)
  assert.equal(api.starts(), 1)
})

test('a job that never completes still has a bounded wait', async () => {
  const api = await harness({ finishesAt: Infinity })
  await assert.rejects(api.run(), /roadmap/)
  assert.equal(api.elapsed(), 900_000)
  assert.equal(api.starts(), 1)
})
