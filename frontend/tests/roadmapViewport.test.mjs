import assert from 'node:assert/strict'
import test from 'node:test'
import { getFitZoom, getGraphFrame, getZoomScroll } from '../src/features/roadmap/viewport.ts'

test('fit respects both viewport axes, padding and existing zoom limits', () => {
  const graph = { width: 1000, height: 2000 }
  const viewport = { width: 800, height: 600 }
  const zoom = getFitZoom(viewport, graph, 44, 0.25, 1.5)
  assert.equal(zoom, 0.256)
  assert.ok(graph.width * zoom + 88 <= viewport.width)
  assert.ok(graph.height * zoom + 88 <= viewport.height)
  assert.equal(getFitZoom({ width: 100, height: 100 }, graph, 44, 0.25, 1.5), 0.25)
  assert.equal(getFitZoom({ width: 10000, height: 10000 }, graph, 44, 0.25, 1.5), 1.5)
  assert.equal(getFitZoom({ width: 0, height: 0 }, graph, 44, 0.25, 1.5), 0.25)
})

test('a fitting graph is centred on both axes without adding overflow', () => {
  assert.deepEqual(getGraphFrame({ width: 900, height: 600 }, { width: 1000, height: 660 }, 0.5, 32), {
    width: 900, height: 600, left: 200, top: 135,
  })
})

test('zoom preserves the graph point at the viewport centre after panning', () => {
  const viewport = { width: 600, height: 400 }
  const graph = { width: 1000, height: 1000 }
  const before = { zoom: 1, left: 200, top: 300 }
  const next = getZoomScroll(viewport, graph, 32, before, 1.5)
  const oldFrame = getGraphFrame(viewport, graph, before.zoom, 32)
  const frame = getGraphFrame(viewport, graph, 1.5, 32)
  assert.equal((before.left + 300 - oldFrame.left) / before.zoom, (next.left + 300 - frame.left) / 1.5)
  assert.equal((before.top + 200 - oldFrame.top) / before.zoom, (next.top + 200 - frame.top) / 1.5)
})

test('zooming out from an edge clamps scroll offsets to valid bounds', () => {
  assert.deepEqual(getZoomScroll({ width: 900, height: 600 }, { width: 1000, height: 660 }, 32,
    { zoom: 1.5, left: 664, top: 454 }, 0.5), { left: 0, top: 0 })
})
