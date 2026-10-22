import { useEffect, useState } from 'react'
import { NodeDetailPanel } from '../components/NodeDetailPanel'
import { RoadmapCanvas } from '../components/RoadmapCanvas'
import { RoadmapHeader } from '../components/RoadmapHeader'
import {
  roadmapConnections,
  roadmapSummary,
} from '../data/roadmapMockData'
import type { RoadmapEvidence, RoadmapNodeData } from '../type'
import type { LearningSourcesLoader } from '../learningSources'
import { roadmapDefaults } from '../defaults'
import { applyStepCheck, canStartNode, completeRoadmapNode, startRoadmapNode, uncompleteLatestNode } from '../progress'
import { loadRoadmap, ROADMAP_STORAGE_KEY, serializeRoadmap } from '../storage'

export function RoadmapPage({ loadSources }: { loadSources?: LearningSourcesLoader }) {
  const [initial] = useState(() => loadRoadmap(roadmapDefaults()))
  const [progress, setProgress] = useState(initial.progress)
  const { nodes, history } = progress
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initial.selectedNodeId)
  const [evidenceByNode, setEvidenceByNode] = useState<Record<string, RoadmapEvidence[]>>(initial.evidenceByNode)
  useEffect(() => {
    try {
      localStorage.setItem(ROADMAP_STORAGE_KEY, serializeRoadmap({ progress, selectedNodeId, evidenceByNode }))
      window.dispatchEvent(new Event('roadmap-updated'))
    } catch {
      console.warn('Roadmap changes could not be saved to browser storage.')
    }
  }, [progress, selectedNodeId, evidenceByNode])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const summary = { ...roadmapSummary, completion: Math.round(nodes.filter((node) => node.status === 'completed').length / nodes.length * 100) }
  function selectNode(node: RoadmapNodeData) { setSelectedNodeId(node.id) }
  function completeNode(id: string) {
    setProgress((current) => {
      const updated = completeRoadmapNode(current.nodes, roadmapConnections, id)
      return updated === current.nodes ? current : { nodes: updated, history: [...current.history, id] }
    })
  }
  function undoCompletion(id: string) {
    setProgress((current) => {
      const updated = uncompleteLatestNode(current.nodes, current.history, id)
      return updated === current.nodes ? current : { nodes: updated, history: current.history.slice(0, -1) }
    })
  }

  return (
    <section aria-label="Career roadmap" className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 gap-4 min-[1200px]:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RoadmapHeader
            summary={summary}
            showProgress={!selectedNode}
          />
          <RoadmapCanvas
            nodes={nodes}
            connections={roadmapConnections}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={selectNode}
            detailsOpen={Boolean(selectedNode)}
            progressSummary={selectedNode ? summary : undefined}
          />
        </div>
        {selectedNode && (
          <>
            <button
              type="button"
              aria-label="Close roadmap details"
              onClick={() => setSelectedNodeId(null)}
              className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px] min-[1200px]:hidden"
            />
            <div className="fixed inset-x-2 bottom-2 top-[6dvh] z-40 overflow-hidden min-[640px]:inset-x-6 min-[640px]:top-[8dvh] min-[1200px]:static min-[1200px]:mt-6 min-[1200px]:h-[calc(100%-1.5rem)] min-[1200px]:w-[304px] min-[1200px]:shrink-0">
              <NodeDetailPanel
                loadSources={loadSources}
                node={selectedNode}
                nodes={nodes}
                onClose={() => setSelectedNodeId(null)}
                onComplete={() => completeNode(selectedNode.id)}
                canStart={canStartNode(nodes, roadmapConnections, selectedNode.id)}
                onStart={() => setProgress((current) => ({ ...current, nodes: startRoadmapNode(current.nodes, roadmapConnections, selectedNode.id) }))}
                canUncomplete={history.at(-1) === selectedNode.id && selectedNode.status === 'completed'}
                onUncomplete={() => undoCompletion(selectedNode.id)}
                onChecklistChange={(itemId, completed) => setProgress((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id && node.status === 'in-progress'
                  ? { ...node, checklist: (node.checklist ?? []).map((item) => item.id === itemId
                    ? { ...item, completed, verified: false, needsReview: completed ? false : item.needsReview } : item) } : node) }))}
                onStepCheckApplied={(verifiedIds, reviewIds) => setProgress((current) => ({ ...current, nodes: applyStepCheck(current.nodes, selectedNode.id, verifiedIds, reviewIds) }))}
                evidenceItems={evidenceByNode[selectedNode.id] ?? []}
                onAddEvidence={(evidence) => setEvidenceByNode((current) => ({ ...current, [selectedNode.id]: [...current[selectedNode.id] ?? [], evidence] }))}
                onRemoveEvidence={(id) => setEvidenceByNode((current) => ({ ...current, [selectedNode.id]: (current[selectedNode.id] ?? []).filter((item) => item.id !== id) }))}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
