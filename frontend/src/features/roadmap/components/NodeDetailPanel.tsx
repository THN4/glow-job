import { Check, Lightbulb, Link2, ListChecks, Star, X } from 'lucide-react'
import { StatusIcon } from '../../../components/StatusIcon'
import type { StepProgressInput } from '../api-types'
import { canCompleteNode } from '../progress'
import type { RoadmapNodeExtra } from '../adapter'
import type { RoadmapEvidence, RoadmapNodeData } from '../type'
import { RoadmapNodeIcon } from './RoadmapNodeIcon'
import { nodeIconColors } from '../nodeAppearance'
import type { RoadmapConnection } from '../type'
import { EvidenceForm } from './EvidenceForm'

type NodeDetailPanelProps = {
  node: RoadmapNodeData
  nodes: RoadmapNodeData[]
  extra: RoadmapNodeExtra | undefined
  canStart: boolean
  evidenceItems: RoadmapEvidence[]
  onAddEvidence: (evidence: RoadmapEvidence) => void
  onRemoveEvidence: (id: string) => void
  connections: RoadmapConnection[]
  busy: boolean
  readOnly?: boolean
  onTaskChange: (taskId: string, completed: boolean) => void
  onStepChange: (stepKey: string, status: StepProgressInput) => void
  onClose: () => void
}

export function NodeDetailPanel({
  node,
  nodes,
  extra,
  canStart,
  evidenceItems,
  onAddEvidence,
  onRemoveEvidence,
  connections,
  busy,
  readOnly = false,
  onTaskChange,
  onStepChange,
  onClose,
}: NodeDetailPanelProps) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const unlockedNodes = (node.unlockIds ?? [])
    .map((id) => nodeById.get(id))
    .filter((item): item is RoadmapNodeData => Boolean(item))
  const checklist = node.checklist ?? []
  const completedCount = checklist.filter((item) => item.completed).length
  const prerequisites = connections.filter((edge) => edge.to === node.id && !edge.optional
    && edge.kind !== 'recommended_order')
    .map((edge) => nodeById.get(edge.from)).filter((item): item is RoadmapNodeData => Boolean(item))
  const reviewedRelations = connections.filter((edge) => (edge.from === node.id || edge.to === node.id)
    && (edge.relationships?.length ?? 0) > 0)
  const canConfirm = canCompleteNode(node)
  const isGoal = node.kind === 'goal'
  const citations = extra?.citations ?? []
  const taskDetails = new Map((extra?.tasks ?? []).map((task) => [task.id, task.detail]))

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-2 px-3.5 pb-2 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${nodeIconColors[node.kind]}`}>
            <RoadmapNodeIcon node={node} size={28} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{node.title}</h2>
            <p className="flex items-center gap-1 text-xs capitalize text-blue-700"><StatusIcon status={node.status} size={12} className="shrink-0" />{node.kind.replace('-', ' ')} · {node.subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close step details"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="scrollbar-subtle min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 pb-6 [scrollbar-gutter:stable]">
        <section className="px-0.5 text-xs text-slate-600">
          {extra?.profileLabel && <p className="font-medium text-blue-700">{extra.profileLabel}</p>}
          {extra?.timeText && <p className="mt-1">Estimated time: {extra.timeText}</p>}
          <p className="mt-2 leading-relaxed">{node.description}</p>
          {extra?.notice && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">{extra.notice}</p>}
        </section>

        {!isGoal && ((extra?.profileEvidence.length ?? 0) > 0 || node.baselineComplete) && <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <h3 className="text-xs font-bold text-slate-900">Evidence from your profile</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Extracted from your CV or profile. This supports the skill record but does not by itself change its completion status.
          </p>
          {(extra?.profileEvidence.length ?? 0) > 0 ? <ul className="mt-2 space-y-2 text-[11px] text-slate-700">
            {extra?.profileEvidence.map((item, index) => <li key={`${item.evidenceType}-${index}`} className="rounded-lg border border-emerald-100 bg-white p-2">
              <p className="text-[10px] font-medium capitalize text-emerald-800">{item.evidenceType.replaceAll('_', ' ')}</p>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{item.excerpt}</p>
            </li>)}
          </ul> : <p className="mt-2 rounded-lg border border-amber-200 bg-white p-2 text-[10px] text-amber-800">
            No CV or project excerpt is linked to this skill in the saved profile.
          </p>}
        </section>}

        <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Lightbulb size={15} className="text-blue-600" aria-hidden="true" /> Why it matters
          </h3>
          <ul className="mt-1.5 min-w-0 max-w-full list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
            {node.whyItMatters.map((reason) => <li key={reason} className="min-w-0 break-words [overflow-wrap:anywhere]">{reason}</li>)}
          </ul>
        </section>

        {reviewedRelations.length > 0 && <section className="rounded-lg border border-violet-100 bg-violet-50/60 p-3">
          <h3 className="text-xs font-bold text-slate-900">Reviewed skill relationships</h3>
          <ul className="mt-2 space-y-3 text-[11px] text-slate-600">
            {reviewedRelations.flatMap((edge) => (edge.relationships ?? []).map((relationship) => {
              const source = nodeById.get(edge.from)
              const target = nodeById.get(edge.to)
              return <li key={relationship.dependencyId} className="rounded-lg border border-violet-100 bg-white p-2">
                <p className="font-semibold text-slate-800">
                  {source?.title ?? edge.from} → {target?.title ?? edge.to}
                  <span className="ml-1 font-normal text-violet-700">{relationship.relationshipType.replace('_', ' ')}</span>
                </p>
                {relationship.scopeNote && <p className="mt-1">{relationship.scopeNote}</p>}
                <p className="mt-1 text-slate-500">Scope: {relationship.scopeType.replace('_', ' ')}</p>
                {relationship.sourceUrl
                  ? <a href={relationship.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-700 underline">{relationship.sourceTitle ?? 'Reviewed source'}</a>
                  : relationship.sourceTitle && <p className="mt-1">Source: {relationship.sourceTitle}</p>}
                <blockquote className="mt-1 border-l-2 border-violet-200 pl-2 text-slate-500">{relationship.evidenceQuote}</blockquote>
              </li>
            }))}
          </ul>
        </section>}

        {prerequisites.length > 0 && <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="text-xs font-bold text-slate-900">Required first</h3>
          <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
            {prerequisites.map((item) => <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.title}</span>
              <span className={item.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}>
                {item.status === 'completed' ? 'Completed' : 'Complete first'}
              </span>
            </li>)}
          </ul>
        </section>}

        {!node.contextOnly && <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Link2 size={15} className="text-blue-600" aria-hidden="true" /> What this unlocks
          </h3>
          {unlockedNodes.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
              {unlockedNodes.map((unlocked) => <li key={unlocked.id}>{unlocked.title}</li>)}
            </ul>
          ) : <p className="mt-1 text-[11px] text-slate-500">No follow-up steps listed.</p>}
        </section>}

        {node.baselineComplete && <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="text-xs font-bold text-slate-900">Skill details</h3>
          {extra?.details.length ? <ul className="mt-2 space-y-3 text-[11px] text-slate-600">
            {extra.details.map((detail) => <li key={detail.title}>
              <p className="font-semibold text-slate-800">{detail.title}</p>
              <p className="mt-0.5 leading-relaxed">{detail.detail}</p>
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-500">No reviewed skill details are available yet.</p>}
        </section>}

        {!isGoal && !node.baselineComplete && !node.contextOnly && <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ListChecks size={15} className="text-blue-600" aria-hidden="true" /> Learning checklist
            </h3>
            <span className="text-[10px] text-slate-500">{completedCount} / {checklist.length} completed</span>
          </div>
          <ul className="mt-2 space-y-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <button type="button" aria-pressed={item.completed} disabled={busy || node.status !== 'in-progress'}
                  onClick={() => onTaskChange(item.id, !item.completed)}
                  className="flex w-full items-start gap-2 text-left text-[11px] text-slate-700 disabled:opacity-60">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {item.completed && <Check size={11} aria-hidden="true" />}
                  </span>
                  {item.label}
                </button>
                {taskDetails.get(item.id) && <p className="mt-1 pl-6 text-[10px] leading-relaxed text-slate-500">{taskDetails.get(item.id)}</p>}
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

        {node.kind !== 'goal' && !node.contextOnly && !readOnly && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Star size={14} className="text-amber-500" aria-hidden="true" /> Evidence
            </h3>
            <EvidenceForm topic={node.title} onSave={onAddEvidence} />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Add projects, certificates, or notes. Evidence is saved in this browser and does not change step status.
          </p>
          {evidenceItems.length > 0 ? <ul className="mt-2 space-y-2">
            {evidenceItems.map((item) => <li key={item.id} className="rounded-lg border border-amber-100 bg-white p-2 text-xs">
              <p className="text-[10px] text-slate-500">{item.type}</p>
              {item.url
                ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline [overflow-wrap:anywhere]">{item.title}</a>
                : <p className="font-medium text-slate-800">{item.title}</p>}
              {item.notes && <p className="mt-1 whitespace-pre-wrap text-[10px] text-slate-600 [overflow-wrap:anywhere]">{item.notes}</p>}
              {item.photo && <img src={item.photo} alt={`Evidence: ${item.title}`} className="mt-2 max-h-40 rounded object-contain" />}
              <button type="button" onClick={() => onRemoveEvidence(item.id)}
                className="mt-1 min-h-8 text-[10px] text-red-700 underline">Remove</button>
            </li>)}
          </ul> : <p className="mt-2 text-[10px] text-slate-500">No evidence added yet.</p>}
        </section>}
      </div>

      {!isGoal && !node.baselineComplete && !node.contextOnly && <footer className="shrink-0 border-t border-slate-100 bg-white p-3">
        <button type="button" disabled={busy || node.learningContentAvailable === false || (node.status === 'upcoming' && !canStart)
          || (node.status === 'in-progress' && !canConfirm)}
          onClick={() => onStepChange(node.id, node.status === 'completed' ? 'not_started' : node.status === 'in-progress' ? 'completed' : 'in_progress')}
          className="min-h-9 w-full rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {node.learningContentAvailable === false ? 'Content not ready' : node.status === 'completed' ? 'Reset step' : node.status === 'in-progress'
            ? canConfirm ? 'Confirm completion' : `Complete checklist (${completedCount}/${checklist.length})`
            : canStart ? 'Start learning' : 'Complete prerequisites first'}
        </button>
      </footer>}
    </aside>
  )
}
