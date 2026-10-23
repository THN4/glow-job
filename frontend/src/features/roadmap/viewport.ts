type Size = { width: number; height: number }

export function getFitZoom(viewport: Size, graph: Size, padding: number, min: number, max: number) {
  if (viewport.width <= 0 || viewport.height <= 0) return min
  return Math.max(min, Math.min(max,
    (viewport.width - padding * 2) / graph.width,
    (viewport.height - padding * 2) / graph.height,
  ))
}

export function getGraphFrame(viewport: Size, graph: Size, zoom: number, padding: number) {
  const width = Math.max(viewport.width, graph.width * zoom + padding * 2)
  const height = Math.max(viewport.height, graph.height * zoom + padding * 2)
  return { width, height, left: (width - graph.width * zoom) / 2, top: (height - graph.height * zoom) / 2 }
}

// Keep the same graph point under the viewport centre when changing scale.
export function getZoomScroll(
  viewport: Size,
  graph: Size,
  padding: number,
  before: { zoom: number; left: number; top: number },
  zoom: number,
) {
  const oldFrame = getGraphFrame(viewport, graph, before.zoom, padding)
  const frame = getGraphFrame(viewport, graph, zoom, padding)
  return {
    left: Math.max(0, Math.min(frame.width - viewport.width,
      (before.left + viewport.width / 2 - oldFrame.left) / before.zoom * zoom + frame.left - viewport.width / 2)),
    top: Math.max(0, Math.min(frame.height - viewport.height,
      (before.top + viewport.height / 2 - oldFrame.top) / before.zoom * zoom + frame.top - viewport.height / 2)),
  }
}
