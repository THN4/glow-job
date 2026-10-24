import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ApplicationStats } from '../shared/ApplicationStats'
import { ApplicationToolbar } from './ApplicationToolbar'
import { ApplicationsTable } from './ApplicationsTable'
import { ApplicationCard } from './ApplicationCard'
import type { ApplicationDateFilter, ApplicationEntry, ApplicationStatusFilter } from '../../type'

type MyApplicationsTabProps = {
  allApplications: ApplicationEntry[]
  filteredApplications: ApplicationEntry[]
  query: string
  status: ApplicationStatusFilter
  dateFilter: ApplicationDateFilter
  onQueryChange: (query: string) => void
  onStatusChange: (status: ApplicationStatusFilter) => void
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
  const pageSize = 10
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filteredApplications.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const firstIndex = (currentPage - 1) * pageSize
  const pageApplications = filteredApplications.slice(firstIndex, firstIndex + pageSize)
  const firstRecord = filteredApplications.length ? firstIndex + 1 : 0
  const lastRecord = Math.min(firstIndex + pageSize, filteredApplications.length)

  const handleQueryChange = (nextQuery: string) => {
    setPage(1)
    onQueryChange(nextQuery)
  }
  const handleStatusChange = (nextStatus: ApplicationStatusFilter) => {
    setPage(1)
    onStatusChange(nextStatus)
  }
  const handleDateChange = (nextDateFilter: ApplicationDateFilter) => {
    setPage(1)
    onDateChange(nextDateFilter)
  }

  return (
    <div className="space-y-3">
      <ApplicationStats applications={allApplications} selectedStatus={status} onSelectStatus={handleStatusChange} />
      <ApplicationToolbar
        query={query}
        status={status}
        dateFilter={dateFilter}
        onQueryChange={handleQueryChange}
        onStatusChange={handleStatusChange}
        onDateChange={handleDateChange}
      />
      <ApplicationsTable applications={pageApplications} onView={onView} />
      <div className="space-y-2 min-[1100px]:hidden">
        {pageApplications.length > 0 ? pageApplications.map((application) => (
          <ApplicationCard key={application.id} application={application} onView={onView} />
        )) : (
          <p className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-slate-500">
            No applications match these filters.
          </p>
        )}
      </div>
      <nav aria-label="Application pages" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 shadow-sm">
        <p className="text-xs text-slate-500">Showing {firstRecord}–{lastRecord} of {filteredApplications.length} matching applications</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-100 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </button>
          <span className="text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-100 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </nav>
      <p className="text-xs text-slate-500">
        In Progress includes Applied, Screening and Interview. Company database jobs are not added automatically.
      </p>
    </div>
  )
}
