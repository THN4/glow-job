import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getSavedProfileId } from '../../resume/api'
import { NodeDetailPanel } from '../components/NodeDetailPanel'
import { RoadmapCanvas } from '../components/RoadmapCanvas'
import { RoadmapHeader } from '../components/RoadmapHeader'
import { generateRoadmap, loadCurrentRoadmap, setRoadmapStep, setRoadmapTask } from '../api'
import type { ProgressStatus, RoadmapJob, RoadmapView } from '../api-types'
import { toRoadmapScreen } from '../adapter'

export function RoadmapPage() {
  const [searchParams] = useSearchParams()
  const requestedNodeKey = searchParams.get('node')
  const [view, setView] = useState<RoadmapView | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [working, setWorking] = useState(false)
  const [stage, setStage] = useState<RoadmapJob['stage'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadCurrentRoadmap(controller.signal)
      .then((loaded) => {
        setView(loaded)
        if (requestedNodeKey && loaded.nodes.some((node) => node.key === requestedNodeKey)) {
          setSelectedNodeId(requestedNodeKey)
        }
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setLoadFailed(true)
          setError(caught instanceof Error ? caught.message : 'เปิด roadmap ไม่สำเร็จ')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [requestedNodeKey])

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

  async function updateStep(stepKey: string, status: ProgressStatus) {
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

  if (loading) return <p role="status" className="p-6 text-sm text-slate-600">Loading your roadmap...</p>
  if (loadFailed) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">Could not load your roadmap</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
      <button type="button" onClick={() => window.location.reload()}
        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
    </section>
  )
  if (!screen) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-blue-100 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Your Career Roadmap</h1>
      <p className="mt-3 text-sm text-slate-600">Your roadmap has not been created yet. Complete onboarding, then create your plan.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {getSavedProfileId() ? <button type="button" disabled={working} onClick={() => createRoadmap()}
        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {working ? `Creating roadmap: ${stage ?? 'queued'}...` : 'Create my roadmap'}
      </button> : <Link to="/onboarding"
        className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">
        Start onboarding
      </Link>}
    </section>
  )

  return (
    <section aria-label="Career roadmap" className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="relative flex min-h-0 flex-1 gap-4 min-[1200px]:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RoadmapHeader summary={screen.summary} showProgress={!selectedNode}
            onRegenerate={() => createRoadmap(true)} regenerating={working} />
          <RoadmapCanvas
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
                onTaskChange={updateTask} onStepChange={updateStep} busy={working}
                onClose={() => setSelectedNodeId(null)} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
