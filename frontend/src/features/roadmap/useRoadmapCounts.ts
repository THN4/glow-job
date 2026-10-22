import { useSyncExternalStore } from 'react'
import { roadmapNodes } from './data/roadmapMockData'
import { ROADMAP_STORAGE_KEY, restoreRoadmap } from './storage'

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
  const snapshot = restoreRoadmap(raw, { progress: { nodes: roadmapNodes, history: [] }, selectedNodeId: null, evidenceByNode: {} })
  const skills = snapshot.progress.nodes.filter((node) => node.kind === 'skill')
  return {
    skills,
    total: skills.length,
    completed: skills.filter((node) => node.status === 'completed').length,
    inProgress: skills.filter((node) => node.status === 'in-progress').length,
    upcoming: skills.filter((node) => node.status === 'upcoming').length,
  }
}
