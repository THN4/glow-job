import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { createUuid } from '../../lib/uuid.ts'

const ACTIVITY_STORAGE_KEY = 'glowjob:roadmap:activity:v1'
const ACTIVITY_UPDATED_EVENT = 'roadmap-activity-updated'

const activitySchema = z.array(z.object({
  id: z.string(),
  kind: z.enum(['goal', 'replan', 'started', 'completed', 'reopened', 'checklist', 'evidence']),
  title: z.string(),
  description: z.string(),
  nodeId: z.string(),
  occurredAt: z.string().datetime(),
}))

export type RoadmapActivity = z.infer<typeof activitySchema>[number]

function readActivity(raw: string | null): RoadmapActivity[] {
  if (!raw) return []
  try { return activitySchema.parse(JSON.parse(raw)) }
  catch { return [] }
}

export function recordRoadmapActivity(activity: Pick<RoadmapActivity, 'kind' | 'title' | 'description' | 'nodeId'>) {
  try {
    const previous = readActivity(localStorage.getItem(ACTIVITY_STORAGE_KEY))
    const entry: RoadmapActivity = { ...activity, id: createUuid(), occurredAt: new Date().toISOString() }
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([entry, ...previous].slice(0, 50)))
    window.dispatchEvent(new Event(ACTIVITY_UPDATED_EVENT))
  } catch {
    console.warn('Roadmap activity could not be saved to browser storage.')
  }
}

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(ACTIVITY_UPDATED_EVENT, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(ACTIVITY_UPDATED_EVENT, notify)
  }
}

function getSnapshot() {
  try { return localStorage.getItem(ACTIVITY_STORAGE_KEY) }
  catch { return null }
}

export function useRoadmapActivity() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return readActivity(raw)
}
