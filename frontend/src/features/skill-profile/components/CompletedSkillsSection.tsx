import { CheckCircle2 } from 'lucide-react'
import { FoundationSummaryCard } from './FoundationSummaryCard'
import { CompletedSkillCard } from './CompletedSkillCard'
import type { SkillProfileSkill } from '../type'

type CompletedSkillsSectionProps = {
  skills: SkillProfileSkill[]
  evidenceBySkill: Record<string, string[]>
  onAddEvidence: (skillId: string) => void
}

export function CompletedSkillsSection({ skills, evidenceBySkill, onAddEvidence }: CompletedSkillsSectionProps) {
  const evidenceCount = Object.values(evidenceBySkill).reduce((sum, evidence) => sum + evidence.length, 0)

  return (
    <section aria-labelledby="completed-heading">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="completed-heading" className="flex items-center gap-1.5 text-base font-bold text-emerald-600">
          <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
          Completed on roadmap
        </h2>
        <p className="text-xs text-slate-500">Skills you’ve completed on your roadmap.</p>
      </div>
      {skills.length > 0 ? (
        <div className="grid items-start gap-3 md:grid-cols-[0.8fr_1.2fr]">
          <FoundationSummaryCard skills={skills} evidenceCount={evidenceCount} />
          <div className="rounded-xl border border-blue-100 bg-white px-4 shadow-sm sm:px-5">
            {skills.map((skill) => (
              <CompletedSkillCard
                key={skill.id}
                skill={skill}
                evidence={evidenceBySkill[skill.id] ?? []}
                onAddEvidence={onAddEvidence}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-blue-200 bg-white p-4 text-xs text-slate-500">
          Completed skills will appear here as you progress along your roadmap.
        </p>
      )}
    </section>
  )
}
