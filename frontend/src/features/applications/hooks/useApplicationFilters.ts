import { useMemo, useState } from 'react'
import type { ApplicationDateFilter, ApplicationEntry, ApplicationStatusFilter } from '../type'

export function useApplicationFilters(applications: ApplicationEntry[]) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ApplicationStatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<ApplicationDateFilter>('all')

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const now = new Date()
    const cutoff = dateFilter === '30-days'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      : dateFilter === 'this-year'
        ? new Date(now.getFullYear(), 0, 1)
        : null

    return applications.filter((application) => {
      const matchesQuery = !normalizedQuery
        || `${application.company} ${application.role}`.toLowerCase().includes(normalizedQuery)
      const matchesStatus = status === 'all'
        || (status === 'in-progress'
          ? ['applied', 'screening', 'interview'].includes(application.status)
          : application.status === status)
      const applicationDate = new Date(`${application.relevantDateISO}T00:00:00`)
      const matchesDate = !cutoff || applicationDate >= cutoff

      return matchesQuery && matchesStatus && matchesDate
    })
  }, [applications, dateFilter, query, status])

  return {
    query,
    setQuery,
    status,
    setStatus,
    dateFilter,
    setDateFilter,
    filteredApplications,
  }
}
