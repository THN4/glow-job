import assert from 'node:assert/strict'
import test from 'node:test'
import { getCompactGraphLayout, ROADMAP_NODE_HEIGHT, ROADMAP_NODE_WIDTH } from '../src/features/roadmap/graphLayout.ts'

test('six independent skills join a lower goal with breathing room for the suggested route', () => {
  const skills = Array.from({ length: 6 }, (_, index) => ({
    id: `skill-${index}`, position: { row: index + 1, column: 1 },
  }))
  const goal = { id: 'goal', position: { row: 7, column: 3 } }
  const layout = getCompactGraphLayout([...skills, goal], skills.map((node) => node.id), true)
  assert.equal(layout.width, 984)
  assert.equal(layout.height, 608)
  assert.ok(layout.positions.goal.y > layout.hub.y)
  assert.equal(layout.hub.y, 0.5)
  const skillRight = layout.positions['skill-0'].x * layout.width + ROADMAP_NODE_WIDTH / 2
  const hubLeft = layout.hub.x * layout.width - ROADMAP_NODE_WIDTH / 2
  const hubRight = layout.hub.x * layout.width + ROADMAP_NODE_WIDTH / 2
  const goalLeft = layout.positions.goal.x * layout.width - ROADMAP_NODE_WIDTH / 2
  assert.equal(hubLeft - skillRight, 160)
  assert.equal(goalLeft - hubRight, 160)
  for (let index = 1; index < skills.length; index++) {
    const gap = (layout.positions[`skill-${index}`].y - layout.positions[`skill-${index - 1}`].y) * layout.height
    assert.ok(Math.abs(gap - ROADMAP_NODE_HEIGHT - 32) < 1e-9)
  }
})

test('sparse server coordinates preserve ordering without creating long empty connections', () => {
  const layout = getCompactGraphLayout([
    { id: 'a', position: { row: 10, column: 2 } },
    { id: 'b', position: { row: 50, column: 9 } },
  ], [], false)
  assert.equal(layout.width, 624)
  assert.equal(layout.height, 312)
  assert.ok(layout.positions.a.x < layout.positions.b.x)
  assert.ok(layout.positions.a.y < layout.positions.b.y)
})

test('mixed prerequisites and independent skills occupy separate lanes and stay within the frame', () => {
  const nodes = [
    { id: 'independent', position: { row: 4, column: 1 } },
    { id: 'prerequisite', position: { row: 1, column: 1 } },
    { id: 'dependent', position: { row: 2, column: 2 } },
    { id: 'goal', position: { row: 3, column: 3 } },
  ]
  const layout = getCompactGraphLayout(nodes, ['independent'], true)
  assert.ok(layout.positions.independent.x < layout.hub.x)
  assert.ok(layout.hub.x < layout.positions.prerequisite.x)
  for (const point of Object.values(layout.positions)) {
    assert.ok(point.x * layout.width >= ROADMAP_NODE_WIDTH / 2)
    assert.ok(point.x * layout.width <= layout.width - ROADMAP_NODE_WIDTH / 2)
    assert.ok(point.y * layout.height >= ROADMAP_NODE_HEIGHT / 2)
    assert.ok(point.y * layout.height <= layout.height - ROADMAP_NODE_HEIGHT / 2)
  }
})

test('a vertical prerequisite chain has room for arrows and labels like the reference layout', () => {
  const skills = Array.from({length: 5}, (_, index) => ({id:`skill-${index}`, position:{row:index+1,column:1}}))
  const chain = ['api', 'project', 'goal'].map((id, index) => ({id, position:{row: index+1,column:3}}))
  const layout = getCompactGraphLayout([...skills, ...chain], skills.map(node=>node.id), true)
  assert.equal(layout.positions.api.x, layout.positions.project.x)
  assert.equal(layout.positions.project.x, layout.positions.goal.x)
  for (const [from, to] of [['api', 'project'], ['project', 'goal']]) {
    const arrowGap = (layout.positions[to].y - layout.positions[from].y) * layout.height - ROADMAP_NODE_HEIGHT
    assert.ok(arrowGap >= 120 - 1e-9)
  }
  assert.equal(layout.hub.y, layout.positions.project.y)
  assert.ok(layout.positions.api.y * layout.height - ROADMAP_NODE_HEIGHT / 2 >= 128)
})
