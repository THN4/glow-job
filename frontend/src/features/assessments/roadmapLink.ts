import type { RoadmapNodeData } from '../roadmap/type'
import type { StepTask } from './types'

/*
 * TEMPORARY bridge between the mock roadmap and the assessments API.
 *
 * The roadmap page still shows mock data (roadmapMockData + skillLearningResources). Step checks
 * pick questions by the knowledge chunk a study task cites, and mock tasks cite curated sources
 * instead of chunks. These maps link the mock to the real chunks and canonical skill IDs.
 * When the roadmap page loads saved roadmaps from the API, task citations already carry
 * chunk IDs (and the backend can derive tasks from roadmapId + stepKey), so delete this file.
 */

/** Mock node slug -> canonical core.skills ID. */
const MOCK_SKILL_IDS: Record<string, number> = { airflow: 103, docker: 85, python: 91, sql: 71 }

/** Curated mock source ID -> knowledge chunk IDs with the same text (Airflow 101 tutorial). */
const MOCK_SOURCE_CHUNKS: Record<string, number[]> = { 'first-workflow': [1], dag: [2], operators: [8] }

export function nodeSkillId(node: RoadmapNodeData): number | undefined {
  return node.skillId ?? MOCK_SKILL_IDS[node.id]
}

/** Study tasks of a step that a step check can ask about (learn tasks with chunk IDs). */
export function stepCheckTasks(node: RoadmapNodeData): StepTask[] {
  return (node.checklist ?? [])
    .filter((item) => item.kind === 'learn' && item.sourceId && MOCK_SOURCE_CHUNKS[item.sourceId])
    .map((item) => ({ taskId: item.id, label: item.label, chunkIds: MOCK_SOURCE_CHUNKS[item.sourceId!] }))
}
