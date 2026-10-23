import { workspaceStyles } from '../../workspace/workspaceStyles'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getSavedProfileId } from '../../resume/api'
import { NodeDetailPanel } from '../components/NodeDetailPanel'
import { RoadmapCanvas } from '../components/RoadmapCanvas'
import { RoadmapHeader } from '../components/RoadmapHeader'
import { generateRoadmap, setRoadmapStep, setRoadmapTask } from '../api'
import { currentRoadmapKey, useCurrentRoadmap } from '../useCurrentRoadmap'
import type { RoadmapJob, RoadmapView, StepProgressInput } from '../api-types'
import { toRoadmapScreen } from '../adapter'
import { canStartNode } from '../progress'
import { recordRoadmapActivity } from '../activity'
import { loadEvidenceByNode, saveEvidenceByNode } from '../storage'
import type { RoadmapEvidence, RoadmapNodeData } from '../type'

export function RoadmapPage() {
  const [searchParams] = useSearchParams()
  const requestedNodeKey = searchParams.get('node')
  const queryClient = useQueryClient()
  const { data: view, isPending: loading, isError: loadFailed, error: loadError } = useCurrentRoadmap()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(requestedNodeKey)
  const [working, setWorking] = useState(false)
  const [stage, setStage] = useState<RoadmapJob['stage'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evidenceByNode, setEvidenceByNode] = useState<Record<string, RoadmapEvidence[]>>(loadEvidenceByNode)

  useEffect(() => { saveEvidenceByNode(evidenceByNode) }, [evidenceByNode])

  const [prevNodeKey, setPrevNodeKey] = useState(requestedNodeKey)
  if (requestedNodeKey !== prevNodeKey) {
    setPrevNodeKey(requestedNodeKey)
    setSelectedNodeId(requestedNodeKey)
  }


  function setView(next: RoadmapView) {
    queryClient.setQueryData(currentRoadmapKey(getSavedProfileId()), next)
    void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
  }

  const screen = useMemo(() => view ? toRoadmapScreen(view) : null, [view])
  const selectedNode = screen?.nodes.find((node) => node.id === selectedNodeId) ?? null

  async function createRoadmap(force = false) {
    if (working) return
    setWorking(true)
    setError(null)
    try {
      setView(await generateRoadmap(setStage, undefined, force))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้าง roadmap ไม่สำเร็จ')
    } finally {
      setStage(null)
      setWorking(false)
    }
  }

  async function updateTask(taskId: string, completed: boolean) {
    if (!view?.roadmapId || working) return
    setWorking(true)
    setError(null)
    try {
      setView(await setRoadmapTask(view.roadmapId, taskId, completed))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกความคืบหน้าไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  async function updateStep(stepKey: string, status: StepProgressInput) {
    if (!view?.roadmapId || working) return
    setWorking(true)
    setError(null)
    try {
      setView(await setRoadmapStep(view.roadmapId, stepKey, status))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกความคืบหน้าไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  function addEvidence(node: RoadmapNodeData, evidence: RoadmapEvidence) {
    setEvidenceByNode((current) => ({ ...current, [node.id]: [...(current[node.id] ?? []), evidence] }))
    recordRoadmapActivity({ kind: 'evidence', title: `Added ${evidence.type} evidence`,
      description: `${evidence.title} for ${node.title}.`, nodeId: node.id })
  }

  function removeEvidence(node: RoadmapNodeData, evidenceId: string) {
    const evidence = evidenceByNode[node.id]?.find((item) => item.id === evidenceId)
    if (!evidence) return
    setEvidenceByNode((current) => ({ ...current,
      [node.id]: (current[node.id] ?? []).filter((item) => item.id !== evidenceId) }))
    recordRoadmapActivity({ kind: 'evidence', title: `Removed evidence from ${node.title}`,
      description: evidence.title, nodeId: node.id })
  }

  if (loading) return <p role="status" className={workspaceStyles.loading}>Loading your roadmap...</p>
  if (loadFailed) return (
    <section className={workspaceStyles.statePanel}>
      <h1 className={workspaceStyles.pageTitle}>Could not load your roadmap</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{loadError?.message}</p>
      <button type="button" onClick={() => window.location.reload()}
        className={`mt-5 ${workspaceStyles.primaryAction}`}>Try again</button>
    </section>
  )
  if (!screen) return (
    <section className={workspaceStyles.statePanel}>
      <h1 className={workspaceStyles.pageTitle}>Your Career Roadmap</h1>
      <p className={workspaceStyles.stateDescription}>Your roadmap has not been created yet. Complete onboarding, then create your plan.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {getSavedProfileId() ? <button type="button" disabled={working} onClick={() => createRoadmap()}
        className={`mt-5 ${workspaceStyles.primaryAction}`}>
        {working ? `Creating roadmap: ${stage ?? 'queued'}...` : 'Create my roadmap'}
      </button> : <Link to="/onboarding"
        className={`mt-5 ${workspaceStyles.primaryAction}`}>
        Start onboarding
      </Link>}
    </section>
  )

  return (
    <section aria-label="Career roadmap" className="mx-auto flex min-h-0 min-w-0 w-full max-w-[1500px] flex-1 flex-col">
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="relative flex min-h-0 min-w-0 flex-1 gap-4 min-[1200px]:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RoadmapHeader summary={screen.summary} showProgress={!selectedNode}
            onRegenerate={() => createRoadmap(true)} regenerating={working} />
          <RoadmapCanvas
            targetRole={screen.summary.targetRole}
            nodes={screen.nodes}
            connections={screen.connections}
            selectedNodeId={selectedNodeId}
            onSelectNode={(node) => setSelectedNodeId(node.id)}
            detailsOpen={Boolean(selectedNode)}
            progressSummary={selectedNode ? screen.summary : undefined}
          />
        </div>
        {selectedNode && (
          <>
            <button type="button" aria-label="Close roadmap details" onClick={() => setSelectedNodeId(null)}
              className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px] min-[1200px]:hidden" />
            <div className="fixed inset-x-2 bottom-2 top-[6dvh] z-40 overflow-hidden min-[640px]:inset-x-6 min-[640px]:top-[8dvh] min-[1200px]:static min-[1200px]:mt-6 min-[1200px]:h-[calc(100%-1.5rem)] min-[1200px]:w-[304px] min-[1200px]:shrink-0">
              <NodeDetailPanel node={selectedNode} nodes={screen.nodes} extra={screen.extras[selectedNode.id]}
                canStart={canStartNode(screen.nodes, screen.dependencies, selectedNode.id)}
                evidenceItems={evidenceByNode[selectedNode.id] ?? []}
                onAddEvidence={(evidence) => addEvidence(selectedNode, evidence)}
                onRemoveEvidence={(id) => removeEvidence(selectedNode, id)}
                connections={screen.dependencies} onTaskChange={updateTask} onStepChange={updateStep} busy={working}
                onClose={() => setSelectedNodeId(null)} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
