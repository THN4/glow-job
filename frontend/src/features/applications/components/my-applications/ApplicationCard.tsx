import { CalendarDays, Eye } from 'lucide-react'
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ApplicationStatusBadge status={application.status} />
          <button
            type="button"
            onClick={() => onView(application)}
            aria-label={`View details for ${application.company} ${application.role}`}
            title="View details"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-100 text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Eye size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarDays size={13} aria-hidden="true" /> {application.relevantDate}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{application.nextStep}</p>
    </article>
  )
}
