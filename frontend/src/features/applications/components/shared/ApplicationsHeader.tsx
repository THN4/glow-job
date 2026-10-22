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
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Data Engineer Internship · 4 months
        </p>
        <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]">
          {titleOverride ?? currentPageTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          {subtitleOverride ?? (detailOpen ? `Your saved record · ${detailLabel}` : currentPageSubtitle)}
        </p>
      </div>
      {backLabel && !formOpen ? (
        <button type="button" onClick={onBack} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-primary transition hover:bg-accent">
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </button>
      ) : !formOpen && activeTab === 'my-applications' && (
        <button
          type="button"
          onClick={onAddApplication}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          <Plus size={16} aria-hidden="true" />
          Add Application
        </button>
      )}
    </header>
  )
}
