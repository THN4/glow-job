import { BriefcaseBusiness, CheckCircle2, CircleX, MessageCircle, Sparkles } from 'lucide-react'
import type { ApplicationEntry, ApplicationStatusFilter } from '../../type'

type ApplicationStatsProps = {
  applications: ApplicationEntry[]
  selectedStatus: ApplicationStatusFilter
  onSelectStatus: (status: ApplicationStatusFilter) => void
}

const statusColors = {
  blue: { text: 'text-blue-700', iconBg: 'bg-blue-50' },
  violet: { text: 'text-violet-700', iconBg: 'bg-violet-50' },
  amber: { text: 'text-amber-700', iconBg: 'bg-amber-50' },
  emerald: { text: 'text-emerald-700', iconBg: 'bg-emerald-50' },
  rose: { text: 'text-rose-700', iconBg: 'bg-rose-50' },
} as const

export function ApplicationStats({ applications, selectedStatus, onSelectStatus }: ApplicationStatsProps) {
  const stats = [
    { label: 'Total', value: applications.length, icon: BriefcaseBusiness, color: statusColors.blue, filter: 'all' as const },
    { label: 'In Progress', value: applications.filter(({ status }) => ['applied', 'screening', 'interview'].includes(status)).length, icon: Sparkles, color: statusColors.violet, filter: 'in-progress' as const },
    { label: 'Interviews', value: applications.filter(({ status }) => status === 'interview').length, icon: MessageCircle, color: statusColors.amber, filter: 'interview' as const },
    { label: 'Offers', value: applications.filter(({ status }) => status === 'offer').length, icon: CheckCircle2, color: statusColors.emerald, filter: 'offer' as const },
    { label: 'Rejected', value: applications.filter(({ status }) => status === 'rejected').length, icon: CircleX, color: statusColors.rose, filter: 'rejected' as const },
  ]

  return (
    <section aria-label="Application statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map(({ label, value, icon: Icon, color, filter }) => {
        const selected = selectedStatus === filter
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectStatus(filter)}
            className={`flex min-h-[68px] cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4 ${selected ? 'border-2 border-blue-500 ring-2 ring-blue-200' : 'border-blue-100'}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color.iconBg} ${color.text}`}>
              <Icon size={17} aria-hidden="true" />
            </span>
            <strong className={`text-2xl font-extrabold leading-none ${color.text}`}>{value}</strong>
            <span className={`text-xs font-medium ${color.text}`}>{label}</span>
          </button>
        )
      })}
    </section>
  )
}
