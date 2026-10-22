import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NodeDetailPanel } from '../components/NodeDetailPanel'
import { RoadmapCanvas } from '../components/RoadmapCanvas'
import { RoadmapHeader } from '../components/RoadmapHeader'
import {
  roadmapConnections,
  roadmapNodes,
  roadmapSummary,
} from '../data/roadmapMockData'
import type { RoadmapEvidence, RoadmapNodeData } from '../type'
import type { LearningSourcesLoader } from '../learningSources'
import { skillLearningResources } from '../data/skillLearningResources'
import { canStartNode, completeRoadmapNode, startRoadmapNode, uncompleteLatestNode } from '../progress'
import { recordRoadmapActivity } from '../activity'
import { loadRoadmap, ROADMAP_STORAGE_KEY, serializeRoadmap } from '../storage'

export function RoadmapPage({ loadSources }: { loadSources?: LearningSourcesLoader }) {
  const [searchParams] = useSearchParams()
  const requestedNodeId = searchParams.get('node')
  const [initial] = useState(() => {
    const loaded = loadRoadmap({ progress: {
    history: roadmapNodes.filter((node) => node.status === 'completed').map((node) => node.id),
    nodes: roadmapNodes.map((node): RoadmapNodeData => ({
    ...node,
    checklist: node.checklist?.length ? node.checklist
      : skillLearningResources[node.id]?.checklist.length ? skillLearningResources[node.id].checklist
      : [{ id: `${node.id}-task`, label: node.description, completed: node.status === 'completed' }],
    })),
    }, selectedNodeId: null, evidenceByNode: {} })
    return requestedNodeId && loaded.progress.nodes.some((node) => node.id === requestedNodeId)
      ? { ...loaded, selectedNodeId: requestedNodeId }
      : loaded
  })
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
    const updated = completeRoadmapNode(nodes, roadmapConnections, id)
    if (updated === nodes) return
    setProgress({ nodes: updated, history: [...history, id] })
    const node = nodes.find((entry) => entry.id === id)
    if (node) recordRoadmapActivity({ kind: 'completed', title: `Completed ${node.title}`, description: 'Marked complete after finishing its checklist.', nodeId: id })
  }
  function undoCompletion(id: string) {
    const updated = uncompleteLatestNode(nodes, history, id)
    if (updated === nodes) return
    setProgress({ nodes: updated, history: history.slice(0, -1) })
    const node = nodes.find((entry) => entry.id === id)
    if (node) recordRoadmapActivity({ kind: 'reopened', title: `Reopened ${node.title}`, description: 'Moved this step back to in progress.', nodeId: id })
  }
  function startNode(id: string) {
    const updated = startRoadmapNode(nodes, roadmapConnections, id)
    if (updated === nodes) return
    setProgress({ ...progress, nodes: updated })
    const node = nodes.find((entry) => entry.id === id)
    if (node) recordRoadmapActivity({ kind: 'started', title: `Started ${node.title}`, description: `${node.title} is now your current roadmap step.`, nodeId: id })
  }
  function changeChecklist(node: RoadmapNodeData, itemId: string, completed: boolean) {
    const item = node.checklist?.find((entry) => entry.id === itemId)
    if (node.status !== 'in-progress' || !item || item.completed === completed) return
    setProgress({ ...progress, nodes: nodes.map((entry) => entry.id === node.id
      ? { ...entry, checklist: entry.checklist?.map((checklistItem) => checklistItem.id === itemId ? { ...checklistItem, completed } : checklistItem) }
      : entry) })
    recordRoadmapActivity({ kind: 'checklist', title: `${completed ? 'Checked' : 'Unchecked'} an item in ${node.title}`, description: item.label, nodeId: node.id })
  }
  function addEvidence(node: RoadmapNodeData, evidence: RoadmapEvidence) {
    setEvidenceByNode((current) => ({ ...current, [node.id]: [...current[node.id] ?? [], evidence] }))
    recordRoadmapActivity({ kind: 'evidence', title: `Added ${evidence.type} evidence`, description: `${evidence.title} for ${node.title}.`, nodeId: node.id })
  }
  function removeEvidence(node: RoadmapNodeData, evidenceId: string) {
    const evidence = evidenceByNode[node.id]?.find((entry) => entry.id === evidenceId)
    if (!evidence) return
    setEvidenceByNode((current) => ({ ...current, [node.id]: (current[node.id] ?? []).filter((entry) => entry.id !== evidenceId) }))
    recordRoadmapActivity({ kind: 'evidence', title: `Removed evidence from ${node.title}`, description: evidence.title, nodeId: node.id })
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
                onStart={() => startNode(selectedNode.id)}
                canUncomplete={history.at(-1) === selectedNode.id && selectedNode.status === 'completed'}
                onUncomplete={() => undoCompletion(selectedNode.id)}
                onChecklistChange={(itemId, completed) => changeChecklist(selectedNode, itemId, completed)}
                evidenceItems={evidenceByNode[selectedNode.id] ?? []}
                onAddEvidence={(evidence) => addEvidence(selectedNode, evidence)}
                onRemoveEvidence={(id) => removeEvidence(selectedNode, id)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
