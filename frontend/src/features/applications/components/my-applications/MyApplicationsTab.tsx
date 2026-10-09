import { ApplicationStats } from '../shared/ApplicationStats'
import { ApplicationToolbar } from './ApplicationToolbar'
import { ApplicationsTable } from './ApplicationsTable'
import { ApplicationCard } from './ApplicationCard'
import type { ApplicationDateFilter, ApplicationEntry, ApplicationStatus } from '../../type'

type MyApplicationsTabProps = {
  allApplications: ApplicationEntry[]
  filteredApplications: ApplicationEntry[]
  query: string
  status: ApplicationStatus | 'all'
  dateFilter: ApplicationDateFilter
  onQueryChange: (query: string) => void
  onStatusChange: (status: ApplicationStatus | 'all') => void
  onDateChange: (dateFilter: ApplicationDateFilter) => void
  onView: (application: ApplicationEntry) => void
}

export function MyApplicationsTab({
  allApplications,
  filteredApplications,
  query,
  status,
  dateFilter,
  onQueryChange,
  onStatusChange,
  onDateChange,
  onView,
}: MyApplicationsTabProps) {
  return (
    <div className="space-y-3">
      <ApplicationStats applications={allApplications} />
      <ApplicationToolbar
        query={query}
        status={status}
        dateFilter={dateFilter}
        onQueryChange={onQueryChange}
        onStatusChange={onStatusChange}
        onDateChange={onDateChange}
      />
      <ApplicationsTable applications={filteredApplications} total={allApplications.length} onView={onView} />
      <div className="space-y-2 min-[1100px]:hidden">
        {filteredApplications.length > 0 ? filteredApplications.map((application) => (
          <ApplicationCard key={application.id} application={application} onView={onView} />
        )) : (
          <p className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-slate-500">
            No applications match these filters.
          </p>
        )}
        <p className="px-1 text-xs text-slate-500">
          Showing {filteredApplications.length} of {allApplications.length} records · Only applications you deliberately add appear here.
        </p>
      </div>
      <p className="text-xs text-slate-500">
        In Progress includes Applied, Screening and Interview. Company database jobs are not added automatically.
      </p>
    </div>
  )
}
