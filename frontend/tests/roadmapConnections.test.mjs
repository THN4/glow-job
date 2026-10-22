import assert from 'node:assert/strict'
import test from 'node:test'
import { arrowColors, isConnectionDashed } from '../src/features/roadmap/connectionAppearance.ts'
import { completeRoadmapNode, startRoadmapNode, uncompleteLatestNode } from '../src/features/roadmap/progress.ts'

test('completed destinations always have solid arrows, including optional paths', () => {
  const required = { from: 'a', to: 'b' }
  for (const status of ['completed', 'in-progress', 'upcoming']) {
    assert.equal(isConnectionDashed(required, status), status === 'upcoming')
    assert.equal(isConnectionDashed({ ...required, optional: true }, status), status !== 'completed')
  }
  assert.equal(arrowColors.completed, '#1e3a5f')
  assert.equal(arrowColors['in-progress'], '#64748b')
  assert.equal(arrowColors.upcoming, '#94a3b8')
})

test('branch selection, completion and reopening update incoming arrow appearance', () => {
  const make = (id, status, row) => ({ id, title: id, kind: 'skill', status, position: { row, column: 1 }, subtitle: status, description: '', whyItMatters: [], checklist: [{ id: 'task', label: 'Study', completed: true }] })
  const edges = [{ from: 'root', to: 'a' }, { from: 'root', to: 'b' }]
  let nodes = [make('root', 'completed', 1), make('a', 'in-progress', 2), make('b', 'upcoming', 3)]
  nodes = startRoadmapNode(nodes, edges, 'b')
  assert.equal(isConnectionDashed(edges[1], nodes[2].status), false)
  assert.equal(isConnectionDashed(edges[0], nodes[1].status), true)
  nodes = completeRoadmapNode(nodes, edges, 'b')
  assert.equal(arrowColors[nodes[2].status], '#1e3a5f')
  nodes = uncompleteLatestNode(nodes, ['root', 'b'], 'b')
  assert.equal(arrowColors[nodes[2].status], '#64748b')
  assert.equal(isConnectionDashed(edges[0], nodes[1].status), true)
})
