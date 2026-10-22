import { useMemo, useSyncExternalStore } from 'react'
import { roadmapDefaults } from './defaults'
import { loadRoadmap, restoreRoadmap, ROADMAP_STORAGE_KEY, serializeRoadmap, type RoadmapSnapshot } from './storage'

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('roadmap-updated', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('roadmap-updated', notify)
  }
}

function getRaw() {
  try { return localStorage.getItem(ROADMAP_STORAGE_KEY) }
  catch { return null }
}

/** The saved roadmap (with checklists) for pages other than the roadmap page. */
export function useRoadmapSnapshot(): RoadmapSnapshot {
  const raw = useSyncExternalStore(subscribe, getRaw, () => null)
  return useMemo(() => restoreRoadmap(raw, roadmapDefaults()), [raw])
}

/** Change the saved roadmap from another page; the roadmap page reads it on its next mount. */
export function updateRoadmapSnapshot(update: (snapshot: RoadmapSnapshot) => RoadmapSnapshot): void {
  try {
    const next = update(loadRoadmap(roadmapDefaults()))
    localStorage.setItem(ROADMAP_STORAGE_KEY, serializeRoadmap(next))
    window.dispatchEvent(new Event('roadmap-updated'))
  } catch {
    console.warn('Roadmap changes could not be saved to browser storage.')
  }
}
