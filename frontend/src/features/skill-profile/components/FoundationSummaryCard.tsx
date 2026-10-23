import { Code2 } from 'lucide-react'
import { SkillIcon } from '../../../components/SkillIcon'
import type { SkillProfileSkill } from '../type'

type FoundationSummaryCardProps = {
  skills: SkillProfileSkill[]
  evidenceCount: number
}

export function FoundationSummaryCard({ skills, evidenceCount }: FoundationSummaryCardProps) {
  return (
    <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5 [@media(max-height:960px)]:p-3.5">
      <h3 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Code2 size={19} aria-hidden="true" />
        </span>
        Your completed foundations
      </h3>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 [@media(max-height:960px)]:mt-3 [@media(max-height:960px)]:gap-y-1.5">
        {skills.map((skill) => (
          <span key={skill.id} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><SkillIcon name={skill.title} size={16} />{skill.title}</span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500 [@media(max-height:960px)]:mt-3">
        Learning complete · Evidence is separate from completion
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1 rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-slate-500 [@media(max-height:960px)]:mt-2 [@media(max-height:960px)]:py-1.5">
        <span className="font-medium text-blue-700">{evidenceCount ? `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} added` : '＋ GitHub project'}</span>
        {!evidenceCount && <span>· Certificate · Self report</span>}
      </div>
    </article>
  )
}
