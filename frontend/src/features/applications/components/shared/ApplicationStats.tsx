import { BriefcaseBusiness, CheckCircle2, CircleX, MessageCircle, Sparkles } from 'lucide-react'
import type { ApplicationEntry } from '../../type'

type ApplicationStatsProps = {
  applications: ApplicationEntry[]
}

export function ApplicationStats({ applications }: ApplicationStatsProps) {
  const stats = [
    { label: 'Total', value: applications.length, icon: BriefcaseBusiness, colors: 'border-blue-100 bg-blue-50/40 text-blue-700' },
    { label: 'In Progress', value: applications.filter(({ status }) => ['applied', 'screening', 'interview'].includes(status)).length, icon: Sparkles, colors: 'border-violet-100 bg-violet-50/40 text-violet-700' },
    { label: 'Interviews', value: applications.filter(({ status }) => status === 'interview').length, icon: MessageCircle, colors: 'border-amber-100 bg-amber-50/40 text-amber-700' },
    { label: 'Offers', value: applications.filter(({ status }) => status === 'offer').length, icon: CheckCircle2, colors: 'border-emerald-100 bg-emerald-50/40 text-emerald-700' },
    { label: 'Rejected', value: applications.filter(({ status }) => status === 'rejected').length, icon: CircleX, colors: 'border-rose-100 bg-rose-50/40 text-rose-700' },
  ]

  return (
    <section aria-label="Application statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map(({ label, value, icon: Icon, colors }) => (
        <article key={label} className={`flex min-h-[62px] items-center gap-2.5 rounded-xl border px-3 py-2.5 sm:px-4 ${colors}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
            <Icon size={16} aria-hidden="true" />
          </span>
          <strong className="text-xl font-bold leading-none">{value}</strong>
          <span className="text-xs">{label}</span>
        </article>
      ))}
    </section>
  )
}
