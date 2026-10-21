import { ArrowRight, CalendarDays } from 'lucide-react'
import { ApplicationStatusBadge } from '../shared/ApplicationStatusBadge'
import type { ApplicationEntry } from '../../type'

type ApplicationCardProps = {
  application: ApplicationEntry
  onView: (application: ApplicationEntry) => void
}

export function ApplicationCard({ application, onView }: ApplicationCardProps) {
  return (
    <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{application.company}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{application.role}</p>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarDays size={13} aria-hidden="true" /> {application.relevantDate}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{application.nextStep}</p>
      <button
        type="button"
        onClick={() => onView(application)}
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border border-blue-100 text-sm font-semibold text-blue-700 hover:bg-blue-50"
      >
        View details <ArrowRight size={14} aria-hidden="true" />
      </button>
    </article>
  )
}
