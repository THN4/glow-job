import { Check, CheckCircle2, ClipboardCheck, FilePlus2, Play, RotateCcw, Target, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRoadmapActivity, type RoadmapActivity } from '../activity'
import { roadmapNodes, roadmapSummary } from '../data/roadmapMockData'
import type { RoadmapNodeData } from '../type'

const appearance = {
  goal: { icon: Target, color: 'bg-slate-100 text-slate-700' },
  replan: { icon: WandSparkles, color: 'bg-blue-50 text-blue-700' },
  started: { icon: Play, color: 'bg-blue-50 text-blue-700' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
  reopened: { icon: RotateCcw, color: 'bg-amber-50 text-amber-700' },
  checklist: { icon: ClipboardCheck, color: 'bg-violet-50 text-violet-700' },
  evidence: { icon: FilePlus2, color: 'bg-cyan-50 text-cyan-700' },
} as const

type DisplayActivity = Pick<RoadmapActivity, 'id' | 'kind' | 'title' | 'description' | 'nodeId'> & { occurredAt?: string; sample?: boolean }

const sampleCompletionDates: Record<string, string> = {
  python: '2026-08-16T12:00:00.000Z',
  sql: '2026-08-20T12:00:00.000Z',
  'etl-pipelines': '2026-09-10T12:00:00.000Z',
  'build-etl-project': '2026-09-12T12:00:00.000Z',
}

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) })
}

export function RecentActivity({ nodes }: { nodes: RoadmapNodeData[] }) {
  const recorded = useRoadmapActivity()
  const initiallyCompleted = new Set(roadmapNodes.filter((node) => node.status === 'completed').map((node) => node.id))
  const completedSnapshot: DisplayActivity[] = nodes.filter((node) => initiallyCompleted.has(node.id) && node.status === 'completed').reverse().map((node) => ({
    id: `initial-${node.id}`,
    kind: 'completed',
    title: `${node.title} marked complete`,
    description: 'This step was completed in the starting roadmap snapshot.',
    nodeId: node.id,
    occurredAt: sampleCompletionDates[node.id],
    sample: true,
  }))
  const currentStep = nodes.find((node) => node.id === 'docker' && node.status === 'in-progress')
  const startingSnapshot: DisplayActivity[] = [
    ...(currentStep ? [{ id: 'initial-docker', kind: 'started' as const, title: 'Docker in progress', description: 'Current step in the starting roadmap snapshot.', nodeId: currentStep.id }] : []),
    ...completedSnapshot,
    { id: 'initial-goal', kind: 'goal', title: 'Career goal set', description: `Goal: ${roadmapSummary.targetRole} within ${roadmapSummary.duration}.`, nodeId: 'data-engineer-goal' },
  ]
  const recordedNodeIds = new Set(recorded.map((activity) => activity.nodeId))
  const activities: DisplayActivity[] = [...recorded, ...startingSnapshot.filter((activity) => !recordedNodeIds.has(activity.nodeId))].slice(0, 6)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="recent-activity-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="recent-activity-title" className="text-base font-bold text-slate-900">Recent activity</h2>
          <p className="mt-1 text-xs text-slate-500">New actions use recorded dates. Dates on starting steps are illustrative.</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Check size={16} aria-hidden="true" /></span>
      </div>
      {activities.length ? (
        <ol className="mt-5">
          {activities.map((activity, index) => {
            const { icon: Icon, color } = appearance[activity.kind]
            return (
              <li key={activity.id} className="flex gap-3">
                <div className="flex w-9 shrink-0 flex-col items-center">
                  <span className={`z-10 flex size-9 items-center justify-center rounded-full ${color}`}><Icon size={17} aria-hidden="true" /></span>
                  {index < activities.length - 1 && <span className="w-px flex-1 bg-slate-200" aria-hidden="true" />}
                </div>
                <div className={`min-w-0 flex-1 ${index < activities.length - 1 ? 'pb-5' : ''}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link to={`/app/roadmap?node=${encodeURIComponent(activity.nodeId)}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline">{activity.title}</Link>
                    {activity.occurredAt && <span className="shrink-0 text-xs text-slate-500"><time dateTime={activity.occurredAt}>{formatDate(activity.occurredAt)}</time>{activity.sample && <span className="ml-1 text-slate-400">· sample</span>}</span>}
                    {!activity.occurredAt && <span className="shrink-0 text-xs text-slate-400">Starting state</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{activity.description}</p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : <p className="mt-4 text-sm text-slate-600">Complete a checklist item or add evidence to start your activity history.</p>}
    </section>
  )
}
