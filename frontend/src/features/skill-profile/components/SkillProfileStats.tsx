import { BookOpen, CheckCircle2, Circle, Clock3 } from 'lucide-react'

type SkillProfileStatsProps = {
  total: number
  completed: number
  inProgress: number
  upcoming: number
  selected: 'all' | 'completed' | 'in-progress' | 'upcoming'
  onSelect: (filter: SkillProfileStatsProps['selected']) => void
}

const statStyles = [
  { icon: BookOpen, color: 'text-slate-700' },
  { icon: CheckCircle2, color: 'text-emerald-600' },
  { icon: Circle, color: 'text-blue-600' },
  { icon: Clock3, color: 'text-slate-500' },
]

export function SkillProfileStats({ total, completed, inProgress, upcoming, selected, onSelect }: SkillProfileStatsProps) {
  const stats = [
    { label: 'Roadmap skills', value: total, filter: 'all' as const },
    { label: 'Completed', value: completed, filter: 'completed' as const },
    { label: 'In progress', value: inProgress, filter: 'in-progress' as const },
    { label: 'Up next', value: upcoming, filter: 'upcoming' as const },
  ]

  return (
    <section aria-label="Skill progress summary" className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {stats.map(({ label, value, filter }, index) => {
        const Icon = statStyles[index].icon
        return (
          <button key={label} type="button" aria-pressed={selected === filter} onClick={() => onSelect(filter)} className={`flex min-h-[78px] items-center gap-3 rounded-xl border px-3 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4 [@media(max-height:960px)]:min-h-[66px] [@media(max-height:960px)]:py-2 ${selected === filter ? 'border-blue-400 bg-blue-50/60' : 'border-blue-100 bg-white'}`}>
            <Icon size={20} className={statStyles[index].color} aria-hidden="true" />
            <div>
              <p className={`text-2xl font-bold leading-none ${statStyles[index].color}`}>{value}</p>
              <p className={`mt-1 text-xs ${statStyles[index].color}`}>{label}</p>
            </div>
          </button>
        )
      })}
    </section>
  )
}
