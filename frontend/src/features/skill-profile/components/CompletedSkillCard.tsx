import { CheckCircle2, Plus } from 'lucide-react'
import { SkillIcon } from '../../../components/SkillIcon'
import { Link } from 'react-router-dom'
import type { SkillProfileSkill } from '../type'

type CompletedSkillCardProps = {
  skill: SkillProfileSkill
  evidence: string[]
  onAddEvidence: (skillId: string) => void
}

export function CompletedSkillCard({ skill, evidence, onAddEvidence }: CompletedSkillCardProps) {
  return (
    <article className="flex flex-col gap-2.5 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 [@media(max-height:960px)]:py-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <SkillIcon name={skill.title} size={15} className="mt-0.5 text-blue-600" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-semibold text-slate-900">{skill.title}</h4>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 size={10} aria-hidden="true" /> Completed
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {evidence.length ? `Evidence added · ${evidence.join(', ')}` : 'No evidence added · Optional'}
          </p>
        </div>
      </div>
      {skill.relatedProject ? (
        <Link
          to="/app/roadmap"
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          {skill.relatedProject.title}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onAddEvidence(skill.id)}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-blue-100 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          <Plus size={12} aria-hidden="true" />
          {evidence.length ? 'Evidence added' : 'Add evidence'}
        </button>
      )}
    </article>
  )
}
