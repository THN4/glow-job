import { z } from 'zod'
import type { RoadmapEvidence, RoadmapNodeData } from './type'

export const ROADMAP_STORAGE_KEY = 'glowjob:roadmap:v1'
const schema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({
    id: z.string(),
    status: z.enum(['completed', 'in-progress', 'upcoming']),
    checklist: z.array(z.object({ id: z.string(), completed: z.boolean(), verified: z.boolean().optional(), needsReview: z.boolean().optional() })),
  })),
  history: z.array(z.string()),
  selectedNodeId: z.string().nullable(),
  evidenceByNode: z.record(z.string(), z.array(z.object({
    id: z.string(), type: z.enum(['GitHub project', 'Certificate', 'Self report']),
    title: z.string(), url: z.string().url().refine((url) => /^https?:\/\//i.test(url)).optional(), notes: z.string(),
    photo: z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
  }))),
})

export type RoadmapSnapshot = {
  progress: { nodes: RoadmapNodeData[]; history: string[] }
  selectedNodeId: string | null
  evidenceByNode: Record<string, RoadmapEvidence[]>
}

export function restoreRoadmap(raw: string | null, defaults: RoadmapSnapshot): RoadmapSnapshot {
  if (!raw) return defaults
  try {
    const saved = schema.parse(JSON.parse(raw))
    const byId = new Map(saved.nodes.map((node) => [node.id, node]))
    const nodes = defaults.progress.nodes.map((node) => {
      const previous = byId.get(node.id)
      if (!previous) return node
      return {
        ...node, status: previous.status,
        subtitle: previous.status === 'completed' ? 'Completed' : previous.status === 'in-progress' ? 'In progress' : 'Upcoming',
        checklist: node.checklist?.map((item) => {
          const saved = previous.checklist.find((entry) => entry.id === item.id)
          return { ...item, completed: saved?.completed ?? item.completed, verified: saved?.verified, needsReview: saved?.needsReview }
        }),
      }
    })
    if (nodes.filter((node) => node.status === 'in-progress').length > 1) return defaults
    const known = new Set(nodes.map((node) => node.id))
    return {
      progress: { nodes, history: [...new Set(saved.history)].filter((id) => nodes.some((node) => node.id === id && node.status === 'completed')) },
      selectedNodeId: saved.selectedNodeId && known.has(saved.selectedNodeId) ? saved.selectedNodeId : null,
      evidenceByNode: Object.fromEntries(Object.entries(saved.evidenceByNode).filter(([id]) => known.has(id))),
    }
  } catch { return defaults }
}

export function serializeRoadmap(snapshot: RoadmapSnapshot): string {
  return JSON.stringify({
    version: 1,
    nodes: snapshot.progress.nodes.map((node) => ({ id: node.id, status: node.status, checklist: (node.checklist ?? []).map(({ id, completed, verified, needsReview }) => ({ id, completed, verified, needsReview })) })),
    history: snapshot.progress.history,
    selectedNodeId: snapshot.selectedNodeId,
    evidenceByNode: snapshot.evidenceByNode,
  })
}

export function loadRoadmap(defaults: RoadmapSnapshot): RoadmapSnapshot {
  try { return restoreRoadmap(localStorage.getItem(ROADMAP_STORAGE_KEY), defaults) }
  catch { return defaults }
}
