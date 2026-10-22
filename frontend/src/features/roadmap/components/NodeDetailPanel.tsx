import {
  Check,
  CheckCircle2,
  Database,
  Lightbulb,
  Link2,
  ListChecks,
  Star,
  X,
} from 'lucide-react'
import type { RoadmapEvidence, RoadmapNodeData } from '../type'
import { EvidenceForm } from './EvidenceForm'
import { skillLearningResources } from '../data/skillLearningResources'
import { LearningSources } from './LearningSources'
import { RoadmapNodeIcon } from './RoadmapNodeIcon'
import { nodeIconColors } from '../nodeAppearance'
import type { LearningSourcesLoader } from '../learningSources'
import { canCompleteNode } from '../progress'

type NodeDetailPanelProps = {
  node: RoadmapNodeData
  nodes: RoadmapNodeData[]
  onClose: () => void
  loadSources?: LearningSourcesLoader
  onComplete: () => void
  canStart: boolean
  onStart: () => void
  canUncomplete: boolean
  onUncomplete: () => void
  onChecklistChange: (id: string, completed: boolean) => void
  evidenceItems: RoadmapEvidence[]
  onAddEvidence: (evidence: RoadmapEvidence) => void
  onRemoveEvidence: (id: string) => void
}

export function NodeDetailPanel({ node, nodes, onClose, loadSources, onComplete, canStart, onStart, canUncomplete, onUncomplete, onChecklistChange, evidenceItems, onAddEvidence, onRemoveEvidence }: NodeDetailPanelProps) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const unlockedNodes = (node.unlockIds ?? [])
    .map((id) => nodeById.get(id))
    .filter((item): item is RoadmapNodeData => Boolean(item))
  const resources = skillLearningResources[node.id]
  const sources = resources?.sources ?? []
  const checklist = node.checklist ?? []
  const completedCount = checklist.filter((item) => item.completed).length
  const isCompleted = node.status === 'completed'

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-2 px-3.5 pt-3.5 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${nodeIconColors[node.kind]}`}>
            <RoadmapNodeIcon node={node} size={28} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{node.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-blue-700">
                {node.kind.replace('-', ' ')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 size={11} aria-hidden="true" />
                {isCompleted ? 'Completed' : node.subtitle}
              </span>
              </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close step details"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 pb-6 [scrollbar-gutter:stable]">
        <section className="px-0.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-slate-600">Current confidence</span>
            <span className="text-[10px] text-slate-400">Separate from completion</span>
          </div>
          <p className="mt-0.5 text-[11px] text-blue-700">Not assessed</p>
          <p className="mt-1.5 text-[11px] leading-[1.45] text-slate-600">{node.description}</p>
        </section>

        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Lightbulb size={15} className="text-blue-600" aria-hidden="true" />
            Why it matters
          </h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10px] leading-[1.45] text-slate-600">
            {node.whyItMatters.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Link2 size={15} className="text-blue-600" aria-hidden="true" />
            What this unlocks
          </h3>
          {unlockedNodes.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unlockedNodes.map((unlocked) => (
                <span key={unlocked.id} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[10px] text-slate-600">
                  <Database size={11} className="text-emerald-600" aria-hidden="true" />
                  {unlocked.title}
                  <Check size={11} className="ml-0.5 text-emerald-600" aria-hidden="true" />
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-slate-500">No follow-up steps listed yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ListChecks size={15} className="text-blue-600" aria-hidden="true" />
              Learning checklist
            </h3>
            <span className="text-[10px] text-slate-500">
              {completedCount} / {checklist.length} completed
            </span>
          </div>
          {checklist.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs leading-5 text-foreground">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={node.status !== 'in-progress'}
                      onChange={(event) => {
                        const completed = event.target.checked
                        onChecklistChange(item.id, completed)
                      }}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span>
                      {item.label}
                      {item.kind && <span className="ml-1 rounded border border-border px-1 text-[9px] uppercase tracking-wide text-muted-foreground">{item.kind}</span>}
                    </span>
                  </label>
                  {item.sourceId && sources.some((source) => source.id === item.sourceId) && !(loadSources && node.skillId) && (
                    <a href={`#learning-source-${item.sourceId}`} className="shrink-0 text-primary underline underline-offset-2">Source</a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[10px] text-slate-500">Checklist will appear as this step is planned.</p>
          )}
        </section>

        <LearningSources
          topic={node.title}
          skillId={node.skillId}
          loadSources={loadSources}
          fallbackSources={sources}
        />
        <section id="evidence-options" className="scroll-mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Star size={14} className="text-amber-500" aria-hidden="true" />
            Evidence you can add
          </h3>
          <p className="mt-1 text-[10px] text-slate-500">
            {evidenceItems.length > 0
              ? `${evidenceItems.length} evidence item${evidenceItems.length === 1 ? '' : 's'} added`
              : `No evidence added · Optional for this ${isCompleted ? 'completed skill' : 'step'}`}
          </p>
          <ul className="mt-2 space-y-2">
            {evidenceItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-white p-2 text-xs">
                <p className="text-[10px] text-muted-foreground">{item.type}</p>
                {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline [overflow-wrap:anywhere]">{item.title}<span className="sr-only"> (opens in a new tab)</span></a> : <p className="font-medium">{item.title}</p>}
                {item.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{item.notes}</p>}
                {item.photo && <a href={item.photo} download={`${item.title}.image`} className="mt-2 block text-primary"><img src={item.photo} alt={`Certificate: ${item.title}`} className="max-h-48 w-full rounded object-contain" /><span className="mt-1 block underline">Download photo</span></a>}
                <button type="button" onClick={() => onRemoveEvidence(item.id)} className="mt-1 min-h-8 text-destructive underline" aria-label={`Remove ${item.title}`}>Remove</button>
              </li>
            ))}
          </ul>        </section>
      </div>

      <footer className="z-10 shrink-0 border-t border-slate-100 bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
        {node.status === 'upcoming' && <p className="mb-2 text-xs text-muted-foreground">{canStart ? 'This branch is available. Choose it to continue here.' : 'Complete the required preceding steps to unlock this checklist.'}</p>}
        <p className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />
          {isCompleted ? 'Learning complete · Review at your own pace' : 'Keep learning · Update your progress as you go'}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={canUncomplete ? onUncomplete : canStart ? onStart : onComplete}
            disabled={!canUncomplete && !canStart && !canCompleteNode(node)}
            title={canUncomplete ? 'Return this step to in progress' : canStart ? 'Continue on this available branch' : isCompleted ? 'Only the latest completed step can be reopened' : node.status === 'upcoming' ? 'Complete the required preceding steps first' : 'Check every checklist item to complete this step'}
            className={`min-h-9 rounded-lg px-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed ${isCompleted ? 'bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400'}`}
          >
            {canUncomplete ? 'Reopen' : canStart ? 'Choose branch' : isCompleted ? 'Completed' : 'Review skill'}
          </button>
          <EvidenceForm key={node.id} topic={node.title} onSave={onAddEvidence} />
        </div>
      </footer>
    </aside>
  )
}
