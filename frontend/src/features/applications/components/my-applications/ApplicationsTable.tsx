import { ApplicationRow } from './ApplicationRow'
import type { ApplicationEntry } from '../../type'

type ApplicationsTableProps = {
  applications: ApplicationEntry[]
  onView: (application: ApplicationEntry) => void
}

export function ApplicationsTable({ applications, onView }: ApplicationsTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm min-[1100px]:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead className="bg-blue-50/70 text-[11px] font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Company / Role</th>
              <th className="px-3 py-2.5">Relevant date</th>
              <th className="px-3 py-2.5">Next step / User-entered note</th>
              <th className="w-36 px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <ApplicationRow key={application.id} application={application} onView={onView} />
            ))}
            {applications.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No applications match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
