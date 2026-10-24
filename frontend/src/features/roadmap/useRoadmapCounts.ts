import { useSyncExternalStore } from 'react'
import type { RoadmapNodeData } from './type'
import { roadmapNodes } from './data/roadmapMockData'
import { skillLearningResources } from './data/skillLearningResources'
import { ROADMAP_STORAGE_KEY, restoreRoadmap, serializeRoadmap, type RoadmapSnapshot } from './storage'
import { recordRoadmapActivity } from './activity'

function defaultRoadmap(): RoadmapSnapshot {
  return {
    progress: {
      history: roadmapNodes.filter((node) => node.status === 'completed').map((node) => node.id),
      nodes: roadmapNodes.map((node): RoadmapNodeData => ({
        ...node,
        checklist: node.checklist?.length ? node.checklist
          : skillLearningResources[node.id]?.checklist.length ? skillLearningResources[node.id].checklist
          : [{ id: `${node.id}-task`, label: node.description, completed: node.status === 'completed' }],
      })),
    },
    selectedNodeId: null,
    evidenceByNode: {},
  }
}

export function updateRoadmapChecklist(nodeId: string, itemId: string, completed: boolean) {
  try {
    const snapshot = restoreRoadmap(localStorage.getItem(ROADMAP_STORAGE_KEY), defaultRoadmap())
    const node = snapshot.progress.nodes.find((entry) => entry.id === nodeId)
    if (!node || node.status !== 'in-progress') return
    const item = node.checklist?.find((entry) => entry.id === itemId)
    if (!item || item.completed === completed) return
    const nodes = snapshot.progress.nodes.map((entry) => entry.id === nodeId
      ? { ...entry, checklist: entry.checklist?.map((item) => item.id === itemId ? { ...item, completed } : item) }
      : entry)
    localStorage.setItem(ROADMAP_STORAGE_KEY, serializeRoadmap({ ...snapshot, progress: { ...snapshot.progress, nodes } }))
    window.dispatchEvent(new Event('roadmap-updated'))
    recordRoadmapActivity({ kind: 'checklist', title: `${completed ? 'Checked' : 'Unchecked'} an item in ${node.title}`, description: item.label, nodeId })
  } catch {
    console.warn('Roadmap checklist changes could not be saved to browser storage.')
  }
}

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('roadmap-updated', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('roadmap-updated', notify)
  }
}
function getSnapshot() {
  try { return localStorage.getItem(ROADMAP_STORAGE_KEY) }
  catch { return null }
}
export function useRoadmapCounts() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const snapshot = restoreRoadmap(raw, defaultRoadmap())
  const nodes = snapshot.progress.nodes
  const skills = nodes.filter((node) => node.kind === 'skill')
  const completedNodes = nodes.filter((node) => node.status === 'completed').length
  return {
    nodes,
    evidenceByNode: snapshot.evidenceByNode,
    skills,
    total: skills.length,
    completed: skills.filter((node) => node.status === 'completed').length,
    inProgress: skills.filter((node) => node.status === 'in-progress').length,
    upcoming: skills.filter((node) => node.status === 'upcoming').length,
    completionPercent: nodes.length ? Math.round((completedNodes / nodes.length) * 100) : 0,
  }
}
