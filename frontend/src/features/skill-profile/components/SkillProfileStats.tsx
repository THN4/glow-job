import { BookOpen, CheckCircle2, Circle, Clock3 } from 'lucide-react'

type SkillProfileStatsProps = {
  total: number
  completed: number
  inProgress: number
  upcoming: number
}

const statStyles = [
  { icon: BookOpen, color: 'text-slate-700' },
  { icon: CheckCircle2, color: 'text-emerald-600' },
  { icon: Circle, color: 'text-blue-600' },
  { icon: Clock3, color: 'text-slate-500' },
]

export function SkillProfileStats({ total, completed, inProgress, upcoming }: SkillProfileStatsProps) {
  const stats = [
    { label: 'Roadmap skills', value: total },
    { label: 'Completed', value: completed },
    { label: 'In progress', value: inProgress },
    { label: 'Up next', value: upcoming },
  ]

  return (
    <section aria-label="Skill progress summary" className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {stats.map(({ label, value }, index) => {
        const Icon = statStyles[index].icon
        return (
          <article key={label} className="flex min-h-[78px] items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-3 shadow-sm sm:px-4 [@media(max-height:960px)]:min-h-[66px] [@media(max-height:960px)]:py-2">
            <Icon size={20} className={statStyles[index].color} aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          </article>
        )
      })}
    </section>
  )
}
