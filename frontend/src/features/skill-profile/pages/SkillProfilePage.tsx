import { useState } from 'react'
import { useRoadmapCounts } from '../../roadmap/useRoadmapCounts'
import { SkillProfileHeader } from '../components/SkillProfileHeader'
import { SkillProfileStats } from '../components/SkillProfileStats'
import { skillProfileMockData } from '../data/skillProfileMockData'

type SkillFilter = 'all' | 'completed' | 'in-progress' | 'upcoming'

const statusLabel = {
  completed: 'Completed',
  'in-progress': 'In progress',
  upcoming: 'Up next',
} as const

const statusStyle = {
  completed: 'bg-emerald-50 text-emerald-700',
  'in-progress': 'bg-blue-50 text-blue-700',
  upcoming: 'bg-slate-100 text-slate-600',
} as const

export function SkillProfilePage() {
  const profile = skillProfileMockData
  const roadmapCounts = useRoadmapCounts()
  const [selectedFilter, setSelectedFilter] = useState<SkillFilter>('all')
  const visibleSkills = roadmapCounts.skills.filter((skill) => selectedFilter === 'all' || skill.status === selectedFilter)
  const visibleLabel = selectedFilter === 'all' ? 'Roadmap skills' : statusLabel[selectedFilter]

  return (
    <section aria-label="Skill profile" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4 [@media(max-height:960px)]:gap-3">
      <SkillProfileHeader targetRole={profile.targetRole} duration={profile.duration} />

      <SkillProfileStats
        {...roadmapCounts}
        selected={selectedFilter}
        onSelect={setSelectedFilter}
      />

      <section aria-live="polite" aria-label={`${visibleLabel} details`} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">{visibleLabel}</h2>
          <span className="text-xs text-slate-500">{visibleSkills.length} {visibleSkills.length === 1 ? 'skill' : 'skills'}</span>
        </div>
        {visibleSkills.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSkills.map((skill) => (
              <article key={skill.id} className="rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{skill.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle[skill.status]}`}>
                    {statusLabel[skill.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{skill.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No {visibleLabel.toLowerCase()} skills yet. Your roadmap progress will appear here.
          </p>
        )}
      </section>
    </section>
  )
}
