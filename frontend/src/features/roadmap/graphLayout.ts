type LayoutNode = {
  id: string
  position: { row: number; column: number }
}

export const ROADMAP_NODE_WIDTH = 200
export const ROADMAP_NODE_HEIGHT = 64

// Geometry belongs to the content, not the viewport. Resizing the canvas must
// never stretch connections or change the distance between learning steps.
export function getCompactGraphLayout(nodes: LayoutNode[], independentIds: string[], hasHub: boolean) {
  const margin = 32
  const columnPitch = ROADMAP_NODE_WIDTH + 160
  const independentPitch = ROADMAP_NODE_HEIGHT + 32
  const prerequisitePitch = ROADMAP_NODE_HEIGHT + 120
  const independent = new Set(independentIds)
  const remaining = nodes.filter((node) => !independent.has(node.id))
  const columns = [...new Set(remaining.map((node) => node.position.column))].sort((a, b) => a - b)
  const rows = [...new Set(remaining.map((node) => node.position.row))].sort((a, b) => a - b)
  const independentLanes = independentIds.length ? 1 : 0
  const hubLanes = hasHub ? 1 : 0
  const laneCount = Math.max(1, independentLanes + hubLanes + columns.length)
  // Keep the top of the right-hand learning route below the floating legend.
  const routeTopInset = hasHub && rows.length > 1 ? 96 : 0
  const width = margin * 2 + ROADMAP_NODE_WIDTH + (laneCount - 1) * columnPitch
  const rowSpan = Math.max(
    Math.max(0, independentIds.length - 1) * independentPitch,
    routeTopInset + Math.max(0, rows.length - 1) * prerequisitePitch,
  )
  const height = margin * 2 + ROADMAP_NODE_HEIGHT + rowSpan
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    const independentIndex = independentIds.indexOf(node.id)
    const lane = independentIndex >= 0 ? 0
      : independentLanes + hubLanes + columns.indexOf(node.position.column)
    const row = independentIndex >= 0 ? independentIndex : rows.indexOf(node.position.row)
    // Independent skills form a compact list. Spread prerequisite stages over
    // the same height, leaving room for arrows and their labels between steps.
    const y = independentIndex >= 0
      ? height / 2 + (row - (independentIds.length - 1) / 2) * independentPitch
      : rows.length > 1
        ? margin + ROADMAP_NODE_HEIGHT / 2 + routeTopInset + row * (rowSpan - routeTopInset) / (rows.length - 1)
        : height / 2 + (hasHub ? rowSpan / 2 : 0)
    positions[node.id] = {
      x: (margin + ROADMAP_NODE_WIDTH / 2 + lane * columnPitch) / width,
      y: y / height,
    }
  }
  return {
    width, height, positions,
    hub: {
      x: (margin + ROADMAP_NODE_WIDTH / 2 + independentLanes * columnPitch) / width,
      y: (height + routeTopInset) / (2 * height),
    },
  }
}
