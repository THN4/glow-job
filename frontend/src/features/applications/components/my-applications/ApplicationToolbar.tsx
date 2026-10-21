import { Search } from 'lucide-react'
import type { ApplicationDateFilter, ApplicationStatus } from '../../type'

type ApplicationToolbarProps = {
  query: string
  status: ApplicationStatus | 'all'
  dateFilter: ApplicationDateFilter
  onQueryChange: (query: string) => void
  onStatusChange: (status: ApplicationStatus | 'all') => void
  onDateChange: (dateFilter: ApplicationDateFilter) => void
}

export function ApplicationToolbar({
  query,
  status,
  dateFilter,
  onQueryChange,
  onStatusChange,
  onDateChange,
}: ApplicationToolbarProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
      <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 shadow-sm focus-within:border-blue-400">
        <Search size={16} className="shrink-0 text-blue-600" aria-hidden="true" />
        <span className="sr-only">Search company or role</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search company or role"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>
      <label className="sr-only" htmlFor="application-status-filter">Filter by status</label>
      <select
        id="application-status-filter"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as ApplicationStatus | 'all')}
        className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-400"
      >
        <option value="all">Status: All</option>
        <option value="wishlist">Status: Wishlist</option>
        <option value="applied">Status: Applied</option>
        <option value="screening">Status: Screening</option>
        <option value="interview">Status: Interview</option>
        <option value="offer">Status: Offer</option>
        <option value="rejected">Status: Rejected</option>
      </select>
      <label className="sr-only" htmlFor="application-date-filter">Filter by date</label>
      <select
        id="application-date-filter"
        value={dateFilter}
        onChange={(event) => onDateChange(event.target.value as ApplicationDateFilter)}
        className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-400"
      >
        <option value="all">Date: All time</option>
        <option value="30-days">Date: Last 30 days</option>
        <option value="this-year">Date: This year</option>
      </select>
    </div>
  )
}
