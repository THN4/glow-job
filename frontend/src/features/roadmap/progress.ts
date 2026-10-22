import type { RoadmapConnection, RoadmapNodeData } from './type'

export function canStartNode(nodes: RoadmapNodeData[], connections: RoadmapConnection[], id: string): boolean {
  return nodes.some((node) => node.id === id && node.status === 'upcoming')
    && connections.filter((edge) => edge.to === id && !edge.optional)
      .every((edge) => nodes.some((node) => node.id === edge.from && node.status === 'completed'))
}

export function startRoadmapNode(nodes: RoadmapNodeData[], connections: RoadmapConnection[], id: string): RoadmapNodeData[] {
  if (!canStartNode(nodes, connections, id)) return nodes
  return nodes.map((node) => node.id === id ? { ...node, status: 'in-progress', subtitle: 'In progress' }
    : node.status === 'in-progress' ? { ...node, status: 'upcoming', subtitle: 'Upcoming' } : node)
}

export function canCompleteNode(node: RoadmapNodeData): boolean {
  return node.status === 'in-progress' && Boolean(node.checklist?.length)
    && node.checklist!.every((item) => item.completed)
}

export function uncompleteLatestNode(nodes: RoadmapNodeData[], history: string[], id: string): RoadmapNodeData[] {
  if (history.at(-1) !== id || !nodes.some((node) => node.id === id && node.status === 'completed')) return nodes
  return nodes.map((node) => {
    if (node.id === id) return { ...node, status: 'in-progress', subtitle: 'In progress' }
    if (node.status === 'in-progress') return { ...node, status: 'upcoming', subtitle: 'Upcoming' }
    return node
  })
}

export function completeRoadmapNode(nodes: RoadmapNodeData[], connections: RoadmapConnection[], id: string): RoadmapNodeData[] {
  const target = nodes.find((node) => node.id === id)
  if (!target || !canCompleteNode(target)) return nodes
  if (connections.some((edge) => edge.to === id && !edge.optional
    && !nodes.some((node) => node.id === edge.from && node.status === 'completed'))) return nodes
  const updated = nodes.map((node): RoadmapNodeData => node.id === id
    ? { ...node, status: 'completed', subtitle: 'Completed' } : node)
  if (updated.some((node) => node.status === 'in-progress')) return updated
  const completed = new Set(updated.filter((node) => node.status === 'completed').map((node) => node.id))
  const next = updated.filter((node) => node.status === 'upcoming'
    && connections.filter((edge) => edge.to === node.id && !edge.optional).every((edge) => completed.has(edge.from)))
    .sort((a, b) => a.position.row - b.position.row || a.position.column - b.position.column)[0]
  return updated.map((node) => node.id === next?.id ? { ...node, status: 'in-progress', subtitle: 'In progress' } : node)
}
