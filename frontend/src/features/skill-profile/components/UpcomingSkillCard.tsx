import { ArrowDown, ArrowRight, Clock3, Container } from 'lucide-react'
import { StatusIcon } from '../../../components/StatusIcon'
import { SkillIcon } from '../../../components/SkillIcon'
import { Link } from 'react-router-dom'
import type { SkillEvidenceSource, SkillProfileSkill } from '../type'
import { EvidencePanel } from './EvidencePanel'

type UpcomingSkillCardProps = {
  skill: SkillProfileSkill
  evidence: SkillEvidenceSource[]
  onToggleEvidence: (source: SkillEvidenceSource) => void
}

export function UpcomingSkillCard({ skill, evidence, onToggleEvidence }: UpcomingSkillCardProps) {
  return (
    <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5 [@media(max-height:960px)]:p-3.5">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-400">
            <SkillIcon name={skill.title} size={20} />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{skill.title}</h3>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              <StatusIcon status="upcoming" size={12} /> Upcoming
            </span>
          </div>
        </div>
      </header>

      <div className="my-4 flex items-center gap-2 border-y border-slate-100 py-3 text-xs text-slate-500 [@media(max-height:960px)]:my-2.5 [@media(max-height:960px)]:py-2">
        <ArrowRight size={13} className="text-blue-500" aria-hidden="true" />
        After Docker
      </div>

      {skill.relatedProject && (
        <div>
          <p className="text-[11px] text-slate-500">Related project</p>
          <Link to="/app/roadmap" className="mt-1.5 inline-flex w-full items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700">
            <Container size={14} className="text-emerald-500" aria-hidden="true" />
            {skill.relatedProject.title}
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
              <Clock3 size={9} aria-hidden="true" /> {skill.relatedProject.status}
            </span>
          </Link>
        </div>
      )}

      <div className="mt-3">
        <EvidencePanel selected={evidence} onToggle={onToggleEvidence} compact />
      </div>
      <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
        <ArrowDown size={11} aria-hidden="true" /> Optional · Add supporting work when you’re ready.
      </p>
    </article>
  )
}
