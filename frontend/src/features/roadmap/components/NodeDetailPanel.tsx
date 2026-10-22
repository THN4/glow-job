import { BriefcaseBusiness, Check, Database, Lightbulb, Link2, ListChecks, Package, Star, X } from 'lucide-react'
import type { ProgressStatus } from '../api-types'
import type { RoadmapNodeExtra } from '../adapter'
import type { RoadmapNodeData } from '../type'

type NodeDetailPanelProps = {
  node: RoadmapNodeData
  nodes: RoadmapNodeData[]
  extra: RoadmapNodeExtra | undefined
  busy: boolean
  onTaskChange: (taskId: string, completed: boolean) => void
  onStepChange: (stepKey: string, status: ProgressStatus) => void
  onClose: () => void
}

function nodeIcon(node: RoadmapNodeData) {
  if (node.kind === 'project') return <Package size={20} aria-hidden="true" />
  if (node.kind === 'career-activity') return <BriefcaseBusiness size={20} aria-hidden="true" />
  if (node.kind === 'goal') return <Star size={20} aria-hidden="true" />
  if (node.status === 'completed') return <Check size={20} aria-hidden="true" />
  return <Database size={20} aria-hidden="true" />
}

export function NodeDetailPanel({ node, nodes, extra, busy, onTaskChange, onStepChange,
                                  onClose }: NodeDetailPanelProps) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const unlockedNodes = (node.unlockIds ?? [])
    .map((id) => nodeById.get(id))
    .filter((item): item is RoadmapNodeData => Boolean(item))
  const checklist = node.checklist ?? []
  const completedCount = checklist.filter((item) => item.completed).length
  const isGoal = node.kind === 'goal'
  const citations = extra?.citations ?? []

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-2 px-3.5 pt-3.5 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            {nodeIcon(node)}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{node.title}</h2>
            <p className="text-xs capitalize text-blue-700">{node.kind.replace('-', ' ')} · {node.subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close step details"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 pb-6 [scrollbar-gutter:stable]">
        <section className="px-0.5 text-xs text-slate-600">
          {extra?.profileLabel && <p className="font-medium text-blue-700">{extra.profileLabel}</p>}
          {extra?.timeText && <p className="mt-1">Estimated time: {extra.timeText}</p>}
          <p className="mt-2 leading-relaxed">{node.description}</p>
          {extra?.notice && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">{extra.notice}</p>}
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Lightbulb size={15} className="text-blue-600" aria-hidden="true" /> Why it matters
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
            {node.whyItMatters.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Link2 size={15} className="text-blue-600" aria-hidden="true" /> What this unlocks
          </h3>
          {unlockedNodes.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
              {unlockedNodes.map((unlocked) => <li key={unlocked.id}>{unlocked.title}</li>)}
            </ul>
          ) : <p className="mt-1 text-[11px] text-slate-500">No follow-up steps listed.</p>}
        </section>

        {node.baselineComplete && <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="text-xs font-bold text-slate-900">Skill details</h3>
          {extra?.details.length ? <ul className="mt-2 space-y-3 text-[11px] text-slate-600">
            {extra.details.map((detail) => <li key={detail.title}>
              <p className="font-semibold text-slate-800">{detail.title}</p>
              <p className="mt-0.5 leading-relaxed">{detail.detail}</p>
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-500">No reviewed skill details are available yet.</p>}
        </section>}

        {!isGoal && !node.baselineComplete && <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ListChecks size={15} className="text-blue-600" aria-hidden="true" /> Learning checklist
            </h3>
            <span className="text-[10px] text-slate-500">{completedCount} / {checklist.length} completed</span>
          </div>
          <ul className="mt-2 space-y-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <button type="button" aria-pressed={item.completed} disabled={busy}
                  onClick={() => onTaskChange(item.id, !item.completed)}
                  className="flex w-full items-start gap-2 text-left text-[11px] text-slate-700 disabled:opacity-60">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {item.completed && <Check size={11} aria-hidden="true" />}
                  </span>
                  {item.label}
                </button>
                {extra?.tasks.find((task) => task.id === item.id)?.detail && (
                  <p className="mt-1 pl-6 text-[10px] leading-relaxed text-slate-500">
                    {extra.tasks.find((task) => task.id === item.id)?.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>}

        {citations.length > 0 && <section className="rounded-xl border border-blue-100 bg-white p-3">
          <h3 className="text-xs font-bold text-slate-900">Sources</h3>
          <ul className="mt-2 space-y-2 text-[11px] text-slate-600">
            {citations.map((citation) => <li key={citation.chunkId}>
              {citation.url ? <a href={citation.url} target="_blank" rel="noreferrer"
                className="font-medium text-blue-700 underline">{citation.title}</a> : <span className="font-medium">{citation.title}</span>}
              <p className="mt-0.5 leading-relaxed">{citation.quote}</p>
            </li>)}
          </ul>
        </section>}
      </div>

      {!isGoal && !node.baselineComplete && <footer className="shrink-0 border-t border-slate-100 bg-white p-3">
        <button type="button" disabled={busy}
          onClick={() => onStepChange(node.id, node.status === 'completed' ? 'not_started' : node.status === 'in-progress' ? 'completed' : 'in_progress')}
          className="min-h-9 w-full rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {node.status === 'completed' ? 'Reset step' : node.status === 'in-progress' ? 'Mark as completed' : 'Start learning'}
        </button>
      </footer>}
    </aside>
  )
}
