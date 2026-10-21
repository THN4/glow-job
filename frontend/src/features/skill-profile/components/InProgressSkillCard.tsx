import { ArrowRight, CheckCircle2, Circle, Container, Link2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SkillChecklistItem, SkillEvidenceSource, SkillProfileSkill } from '../type'
import { EvidencePanel } from './EvidencePanel'
import { LearningChecklist } from './LearningChecklist'

type InProgressSkillCardProps = {
  skill: SkillProfileSkill
  checklist: SkillChecklistItem[]
  evidence: SkillEvidenceSource[]
  started: boolean
  onToggleChecklist: (itemId: string) => void
  onToggleEvidence: (source: SkillEvidenceSource) => void
  onStart: () => void
  onMarkCompleted: () => void
}

export function InProgressSkillCard({
  skill,
  checklist,
  evidence,
  started,
  onToggleChecklist,
  onToggleEvidence,
  onStart,
  onMarkCompleted,
}: InProgressSkillCardProps) {
  const checklistComplete = checklist.length > 0 && checklist.every((item) => item.completed)

  return (
    <article className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5 [@media(max-height:960px)]:p-3.5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 [@media(max-height:960px)]:pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            <Container size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{skill.title}</h3>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              <Circle size={8} aria-hidden="true" /> In progress
            </span>
          </div>
        </div>
        <span className="pt-1 text-[11px] font-medium text-blue-700">Your current roadmap skill</span>
      </header>

      <div className="grid gap-4 py-4 md:grid-cols-[1fr_1fr] [@media(max-height:960px)]:gap-3 [@media(max-height:960px)]:py-2.5">
        <LearningChecklist items={checklist} onToggle={onToggleChecklist} />
        <div className="space-y-4 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0 [@media(max-height:960px)]:space-y-2.5 [@media(max-height:960px)]:pt-2.5">
          <div>
            <p className="text-[11px] text-slate-500">Related project</p>
            {skill.relatedProject && (
              <Link to="/app/roadmap" className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700">
                <Container size={14} className="text-emerald-500" aria-hidden="true" />
                {skill.relatedProject.title}
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                  {skill.relatedProject.status}
                </span>
              </Link>
            )}
          </div>
          <EvidencePanel selected={evidence} onToggle={onToggleEvidence} />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 [@media(max-height:960px)]:pt-2.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            {started ? 'Learning started' : 'Start learning'}
            {!started && <ArrowRight size={12} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={!checklistComplete}
            title={checklistComplete ? 'Mark this skill as completed' : 'Complete the checklist to finish this skill'}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-blue-100 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400 disabled:hover:bg-white"
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            Mark as completed
          </button>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Link2 size={11} aria-hidden="true" />
          Estimated time: {skill.timing}
        </span>
      </footer>
    </article>
  )
}
