import assert from 'node:assert/strict'
import test from 'node:test'
import { restoreRoadmap, serializeRoadmap } from '../src/features/roadmap/storage.ts'

const node = { id: 'docker', title: 'Docker', kind: 'skill', status: 'in-progress', subtitle: 'In progress', description: 'Current description', position: { row: 1, column: 1 }, whyItMatters: [], checklist: [{ id: 'study', label: 'Study Docker', completed: false }] }
const defaults = { progress: { nodes: [node], history: [] }, selectedNodeId: null, evidenceByNode: {} }

test('restores completion, checklists, history, selected node and evidence after reload', () => {
  const saved = {
    progress: { nodes: [{ ...node, status: 'completed', checklist: [{ ...node.checklist[0], completed: true }] }], history: ['docker'] },
    selectedNodeId: 'docker',
    evidenceByNode: { docker: [{ id: 'proof', type: 'Self report', title: 'Study notes', notes: 'Ran my first container.' }] },
  }
  const result = restoreRoadmap(serializeRoadmap(saved), defaults)
  assert.equal(result.progress.nodes[0].status, 'completed')
  assert.equal(result.progress.nodes[0].checklist[0].completed, true)
  assert.deepEqual(result.progress.history, ['docker'])
  assert.equal(result.selectedNodeId, 'docker')
  assert.deepEqual(result.evidenceByNode, saved.evidenceByNode)
})

test('invalid or unsupported saved data falls back to defaults', () => {
  for (const raw of [null, '{broken', '{}', '{"version":2}']) assert.equal(restoreRoadmap(raw, defaults), defaults)
})

test('restores user changes against current node content instead of stale definitions', () => {
  const old = { ...defaults, progress: { nodes: [{ ...node, description: 'Outdated', checklist: [{ ...node.checklist[0], completed: true }] }], history: [] } }
  const restored = restoreRoadmap(serializeRoadmap(old), defaults)
  assert.equal(restored.progress.nodes[0].description, 'Current description')
  assert.equal(restored.progress.nodes[0].checklist[0].completed, true)
})

test('rejects unsafe saved evidence links', () => {
  const saved = { ...defaults, evidenceByNode: { docker: [{ id: 'bad', type: 'Self report', title: 'Bad', notes: '', url: 'javascript:alert(1)' }] } }
  assert.equal(restoreRoadmap(serializeRoadmap(saved), defaults), defaults)
})

test('certificate photos survive reload while unsupported image formats are rejected', () => {
  const photo = 'data:image/png;base64,aGVsbG8='
  const saved = { ...defaults, evidenceByNode: { docker: [{ id: 'certificate', type: 'Certificate', title: 'Docker course', notes: '', photo }] } }
  assert.equal(restoreRoadmap(serializeRoadmap(saved), defaults).evidenceByNode.docker[0].photo, photo)
  saved.evidenceByNode.docker[0].photo = 'data:image/svg+xml;base64,aGVsbG8='
  assert.equal(restoreRoadmap(serializeRoadmap(saved), defaults), defaults)
})
