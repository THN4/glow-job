import { ArrowLeft } from 'lucide-react'
import { workspaceStyles } from '../../../workspace/workspaceStyles'
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
  const currentPageTitle = activeTab === 'my-applications' ? 'Applications' : companiesTab ? 'Companies' : 'Recommendations'
  const currentPageSubtitle = activeTab === 'my-applications'
    ? 'Manage your applications, explore career paths and browse company openings.'
    : companiesTab
      ? 'Browse sample openings from the app’s job database—not your application records.'
      : 'Find jobs for your skills or explore career paths based on your saved profile.'
  const isRecommendationDetail = activeTab === 'recommendations' && Boolean(titleOverride)
  const backButton = backLabel && !formOpen && (
    <button type="button" onClick={onBack} className={workspaceStyles.outlineAction}>
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
