import {
  Award,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Database,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Package,
  Star,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { RoadmapNodeData } from '../type'

type NodeDetailPanelProps = {
  node: RoadmapNodeData
  nodes: RoadmapNodeData[]
  onClose: () => void
}

const evidenceOptions = [
  { label: 'GitHub project', icon: 'project' },
  { label: 'Certificate', icon: 'certificate' },
  { label: 'Self report', icon: 'self-report' },
] as const

function renderNodeIcon(node: RoadmapNodeData) {
  if (node.kind === 'project') return <Package size={20} aria-hidden="true" />
  if (node.kind === 'career-activity') return <BriefcaseBusiness size={20} aria-hidden="true" />
  if (node.kind === 'goal') return <Star size={20} aria-hidden="true" />
  if (node.status === 'completed') return <Check size={22} aria-hidden="true" />
  return <Database size={20} aria-hidden="true" />
}

function renderEvidenceIcon(icon: (typeof evidenceOptions)[number]['icon']) {
  if (icon === 'project') return <BriefcaseBusiness size={11} aria-hidden="true" />
  if (icon === 'certificate') return <Award size={11} aria-hidden="true" />
  return <FileText size={11} aria-hidden="true" />
}

export function NodeDetailPanel({ node, nodes, onClose }: NodeDetailPanelProps) {
  const [evidenceItems, setEvidenceItems] = useState<string[]>([])
  const [reviewed, setReviewed] = useState(false)
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const unlockedNodes = (node.unlockIds ?? [])
    .map((id) => nodeById.get(id))
    .filter((item): item is RoadmapNodeData => Boolean(item))
  const checklist = node.checklist ?? []
  const completedCount = checklist.filter((item) => item.completed).length
  const isCompleted = node.status === 'completed'

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-2 px-3.5 pt-3.5 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            {renderNodeIcon(node)}
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

        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Lightbulb size={15} className="text-blue-600" aria-hidden="true" />
            Why it matters
          </h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10px] leading-[1.45] text-slate-600">
            {node.whyItMatters.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
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

        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
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
                <li key={item.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] ${item.completed ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'}`}>
                    {item.completed && <Check size={10} aria-hidden="true" />}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[10px] text-slate-500">Checklist will appear as this step is planned.</p>
          )}
        </section>

        <section id="evidence-options" className="scroll-mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Star size={14} className="text-amber-500" aria-hidden="true" />
            Evidence you can add
          </h3>
          <p className="mt-1 text-[10px] text-slate-500">
            {evidenceItems.length > 0
              ? `${evidenceItems.length} evidence item${evidenceItems.length === 1 ? '' : 's'} added`
              : `No evidence added · Optional for this ${isCompleted ? 'completed skill' : 'step'}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {evidenceOptions.map(({ label, icon }) => {
              const added = evidenceItems.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={added}
                  onClick={() => setEvidenceItems((current) => (
                    added ? current.filter((item) => item !== label) : [...current, label]
                  ))}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] transition ${added ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-blue-100 bg-white text-slate-600 hover:bg-blue-50'}`}
                >
                  {renderEvidenceIcon(icon)}
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <footer className="z-10 shrink-0 border-t border-slate-100 bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />
          {isCompleted ? 'Learning complete · Review at your own pace' : 'Keep learning · Update your progress as you go'}
        </p>
        {reviewed && <p className="mb-2 text-[10px] text-emerald-700">Skill marked as reviewed.</p>}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setReviewed(true)}
            className="min-h-9 rounded-lg bg-blue-600 px-2 text-[10px] font-semibold text-white hover:bg-blue-700"
          >
            {reviewed ? 'Reviewed' : 'Review skill'}
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('evidence-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="min-h-9 rounded-lg border border-blue-200 px-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
          >
            Manage evidence
          </button>
        </div>
      </footer>
    </aside>
  )
}
