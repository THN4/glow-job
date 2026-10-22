import { roadmapNodes } from './data/roadmapMockData'
import { skillLearningResources } from './data/skillLearningResources'
import type { RoadmapNodeData } from './type'
import type { RoadmapSnapshot } from './storage'

/** The starting roadmap state: mock nodes with their curated checklists. Shared by every page that reads the roadmap. */
export function roadmapDefaults(): RoadmapSnapshot {
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
