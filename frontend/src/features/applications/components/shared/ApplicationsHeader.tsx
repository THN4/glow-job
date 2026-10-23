import { ArrowLeft } from 'lucide-react'
import { WorkspacePageHeader } from '../../../workspace/components/WorkspacePageHeader'
import type { ApplicationTabKey } from '../../type'

type ApplicationsHeaderProps = {
  formOpen?: boolean
  detailOpen?: boolean
  detailLabel?: string
  onBack?: () => void
  activeTab?: ApplicationTabKey
  titleOverride?: string
  subtitleOverride?: string
  backLabel?: string
}

export function ApplicationsHeader({ formOpen = false, detailOpen = false, detailLabel, onBack, activeTab = 'my-applications', titleOverride, subtitleOverride, backLabel }: ApplicationsHeaderProps) {
  const companiesTab = activeTab === 'companies'
  const currentPageTitle = activeTab === 'my-applications' ? 'Applications' : companiesTab ? 'Companies' : 'Career Recommendations'
  const currentPageSubtitle = activeTab === 'my-applications'
    ? 'Manage your applications, explore career paths and browse company openings.'
    : companiesTab
      ? 'Browse sample openings from the app’s job database—not your application records.'
      : 'Explore broad career paths grounded in your skills, experience and current goal.'
  const isRecommendationDetail = activeTab === 'recommendations' && Boolean(titleOverride)
  const backButton = backLabel && !formOpen && (
    <button type="button" onClick={onBack} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-primary transition hover:bg-accent">
      <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
    </button>
  )
  return (
    <WorkspacePageHeader
      title={isRecommendationDetail ? currentPageTitle : titleOverride ?? currentPageTitle}
      detailTitle={isRecommendationDetail ? titleOverride : undefined}
      description={subtitleOverride ?? (detailOpen ? `Your saved record · ${detailLabel}` : currentPageSubtitle)}
      actions={backButton}
    />
  )
}
