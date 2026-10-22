import assert from 'node:assert/strict'
import test from 'node:test'
import { canCompleteNode, canStartNode, startRoadmapNode, completeRoadmapNode, uncompleteLatestNode } from '../src/features/roadmap/progress.ts'

function node(id, status, row, checked = true) {
  return { id, title: id, kind: 'skill', status, position: { row, column: 1 }, subtitle: status, description: '', whyItMatters: [], checklist: [{ id: 'task', label: 'Study', completed: checked }] }
}

test('users can choose an unlocked branch without losing progress or creating two pins', () => {
  const nodes = [node('root', 'completed', 1), node('left', 'in-progress', 2, false), node('right', 'upcoming', 2), node('join', 'upcoming', 3)]
  const edges = [{ from: 'root', to: 'left' }, { from: 'root', to: 'right' }, { from: 'left', to: 'join' }, { from: 'right', to: 'join' }]
  assert.equal(canStartNode(nodes, edges, 'right'), true)
  const result = startRoadmapNode(nodes, edges, 'right')
  assert.equal(result[1].status, 'upcoming')
  assert.deepEqual(result[1].checklist, nodes[1].checklist)
  assert.equal(result[2].status, 'in-progress')
  assert.equal(result.filter((item) => item.status === 'in-progress').length, 1)
  assert.equal(startRoadmapNode(nodes, edges, 'join'), nodes)
  assert.equal(startRoadmapNode(nodes, edges, 'root'), nodes)
})

test('undo reopens only the latest completed node and moves the current pin back', () => {
  const nodes = [node('a', 'completed', 1), node('b', 'completed', 2), node('c', 'in-progress', 3)]
  const result = uncompleteLatestNode(nodes, ['a', 'b'], 'b')
  assert.equal(result[0].status, 'completed')
  assert.equal(result[1].status, 'in-progress')
  assert.equal(result[2].status, 'upcoming')
  assert.deepEqual(result[1].checklist, nodes[1].checklist)
  assert.equal(uncompleteLatestNode(nodes, ['a', 'b'], 'a'), nodes)
  assert.equal(uncompleteLatestNode(nodes, [], 'b'), nodes)
})

test('undo works after the final node and supports completing it again', () => {
  const nodes = [node('last', 'completed', 1)]
  const reopened = uncompleteLatestNode(nodes, ['last'], 'last')
  assert.equal(reopened[0].status, 'in-progress')
  assert.equal(completeRoadmapNode(reopened, [], 'last')[0].status, 'completed')
})

test('completion requires a nonempty, fully checked checklist', () => {
  assert.equal(canCompleteNode(node('a', 'in-progress', 1, false)), false)
  assert.equal(canCompleteNode({ ...node('a', 'in-progress', 1), checklist: [] }), false)
  assert.equal(canCompleteNode(node('a', 'completed', 1)), false)
  const nodes = [node('a', 'in-progress', 1, false)]
  assert.equal(completeRoadmapNode(nodes, [], 'a'), nodes)
})

test('completing current step advances the single current status used by the pin', () => {
  const nodes = [node('docker', 'in-progress', 1), node('airflow', 'upcoming', 2, false)]
  const result = completeRoadmapNode(nodes, [{ from: 'docker', to: 'airflow' }], 'docker')
  assert.equal(result[0].status, 'completed')
  assert.equal(result[1].status, 'in-progress')
  assert.equal(result[1].subtitle, 'In progress')
  assert.equal(nodes[0].status, 'in-progress')
})

test('branch joins wait for all required predecessors; ready branches use visual order', () => {
  const nodes = [node('a', 'in-progress', 1), node('join', 'upcoming', 2), node('branch', 'upcoming', 3)]
  const edges = [{ from: 'a', to: 'join' }, { from: 'branch', to: 'join' }, { from: 'a', to: 'branch' }]
  const result = completeRoadmapNode(nodes, edges, 'a')
  assert.equal(result.find((item) => item.id === 'join').status, 'upcoming')
  assert.equal(result.find((item) => item.id === 'branch').status, 'in-progress')
})

test('completing another node does not move an existing current step', () => {
  const result = completeRoadmapNode([node('a', 'in-progress', 1), node('b', 'upcoming', 2)], [], 'b')
  assert.equal(result.filter((item) => item.status === 'in-progress').length, 1)
  assert.equal(result[0].status, 'in-progress')
  assert.equal(result[1].status, 'upcoming')
})

test('even a current step cannot bypass required unfinished predecessors', () => {
  const nodes = [node('a', 'upcoming', 1), node('b', 'in-progress', 2)]
  assert.equal(completeRoadmapNode(nodes, [{ from: 'a', to: 'b' }], 'b'), nodes)
})

test('finishing the final node leaves no current pin and repeat completion is harmless', () => {
  const result = completeRoadmapNode([node('last', 'in-progress', 1)], [], 'last')
  assert.equal(result.every((item) => item.status === 'completed'), true)
  assert.equal(completeRoadmapNode(result, [], 'last'), result)
})
