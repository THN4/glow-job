import { ArrowLeft, Plus } from 'lucide-react'
import type { ApplicationTabKey } from '../../type'

type ApplicationsHeaderProps = {
  onAddApplication: () => void
  formOpen?: boolean
  detailOpen?: boolean
  detailLabel?: string
  onBack?: () => void
  activeTab?: ApplicationTabKey
  titleOverride?: string
  subtitleOverride?: string
  backLabel?: string
}

export function ApplicationsHeader({ onAddApplication, formOpen = false, detailOpen = false, detailLabel, onBack, activeTab = 'my-applications', titleOverride, subtitleOverride, backLabel }: ApplicationsHeaderProps) {
  const companiesTab = activeTab === 'companies'
  const currentPageTitle = activeTab === 'my-applications' ? 'Applications' : companiesTab ? 'Companies' : 'Career Recommendations'
  const currentPageSubtitle = activeTab === 'my-applications'
    ? 'Manage your applications, explore career paths and browse company openings.'
    : companiesTab
      ? 'Browse sample openings from the app’s job database—not your application records.'
      : 'Explore broad career paths grounded in your skills, experience and current goal.'
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
          Data Engineer Internship · 4 months
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          {titleOverride ?? currentPageTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {subtitleOverride ?? (detailOpen ? `Your saved record · ${detailLabel}` : currentPageSubtitle)}
        </p>
      </div>
      {backLabel && !formOpen ? (
        <button type="button" onClick={onBack} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </button>
      ) : !formOpen && activeTab === 'my-applications' && (
        <button
          type="button"
          onClick={onAddApplication}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} aria-hidden="true" />
          Add Application
        </button>
      )}
    </header>
  )
}
