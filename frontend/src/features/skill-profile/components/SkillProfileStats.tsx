import { BookOpen, CheckCircle2, Circle, Clock3 } from 'lucide-react'

type SkillProfileStatsProps = {
  total: number
  completed: number
  inProgress: number
  upcoming: number
  totalProjects: number
  completedProjects: number
  inProgressProjects: number
  upcomingProjects: number
  selected: 'all' | 'completed' | 'in-progress' | 'upcoming'
  onSelect: (filter: SkillProfileStatsProps['selected']) => void
}

const statStyles = [
  { icon: BookOpen, color: 'text-slate-700' },
  { icon: CheckCircle2, color: 'text-emerald-600' },
  { icon: Circle, color: 'text-blue-600' },
  { icon: Clock3, color: 'text-slate-500' },
]

export function SkillProfileStats({ total, completed, inProgress, upcoming, totalProjects, completedProjects, inProgressProjects, upcomingProjects, selected, onSelect }: SkillProfileStatsProps) {
  const stats = [
    { label: 'Roadmap skills', value: total, projects: totalProjects, filter: 'all' as const },
    { label: 'Completed', value: completed, projects: completedProjects, filter: 'completed' as const },
    { label: 'In progress', value: inProgress, projects: inProgressProjects, filter: 'in-progress' as const },
    { label: 'Up next', value: upcoming, projects: upcomingProjects, filter: 'upcoming' as const },
  ]

  return (
    <section aria-label="Skill progress summary" className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {stats.map(({ label, value, projects, filter }, index) => {
        const Icon = statStyles[index].icon
        return (
          <button key={label} type="button" aria-pressed={selected === filter} onClick={() => onSelect(filter)} className={`flex min-h-[78px] cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4 [@media(max-height:960px)]:min-h-[66px] [@media(max-height:960px)]:py-2 ${selected === filter ? 'border-blue-500' : 'border-blue-100'}`}>
            <Icon size={20} className={statStyles[index].color} aria-hidden="true" />
            <p className={`min-w-7 text-2xl font-bold leading-none ${statStyles[index].color}`}>{value}</p>
            <div className="min-w-0">
              <p className={`mt-1 text-xs ${statStyles[index].color}`}>{label}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{projects} {projects === 1 ? 'project' : 'projects'}</p>
            </div>
          </button>
        )
      })}
    </section>
  )
}
