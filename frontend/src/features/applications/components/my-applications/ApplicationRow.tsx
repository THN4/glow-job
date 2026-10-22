import { Eye } from 'lucide-react'
import { ApplicationStatusBadge } from '../shared/ApplicationStatusBadge'
import type { ApplicationEntry } from '../../type'

type ApplicationRowProps = {
  application: ApplicationEntry
  onView: (application: ApplicationEntry) => void
}

export function ApplicationRow({ application, onView }: ApplicationRowProps) {
  return (
    <tr className="border-t border-slate-100 text-sm text-slate-600 transition hover:bg-blue-50/40">
      <td className="px-3 py-2.5">
        <p className="font-semibold text-slate-900">{application.company}</p>
        <p className="mt-0.5 text-xs text-slate-500">{application.role}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs">{application.relevantDate}</td>
      <td className="max-w-[320px] px-3 py-2.5 text-xs">{application.nextStep}</td>
      <td className="w-36 px-3 py-2.5"><ApplicationStatusBadge status={application.status} /></td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={() => onView(application)}
          aria-label={`View details for ${application.company} ${application.role}`}
          title="View details"
          className="inline-flex size-8 items-center justify-center rounded-lg text-blue-700 transition hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Eye size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  )
}
