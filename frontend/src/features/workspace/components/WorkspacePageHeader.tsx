import { workspaceStyles } from '../workspaceStyles'
import type { ReactNode } from 'react'
import { useCareerGoal } from '../../roadmap/useCareerGoal'
import { formatGoalContext } from '../goalContext'

type WorkspacePageHeaderProps = {
  title: string
  description: ReactNode
  detailTitle?: string
  actions?: ReactNode
}

export function WorkspacePageHeader({ title, description, detailTitle, actions }: WorkspacePageHeaderProps) {
  const goal = useCareerGoal()
  const context = goal.isLoading ? 'Loading career goal…'
    : goal.isError ? 'Career goal unavailable'
      : formatGoalContext(goal.data)
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 font-sans">
      <div className="min-w-0 flex-1">
        <p className={workspaceStyles.pageContext}>{context}</p>
        <h1 className={workspaceStyles.pageTitle}>{title}</h1>
        {detailTitle && <h2 className="mt-3 text-lg font-semibold text-foreground">{detailTitle}</h2>}
        <p className={workspaceStyles.pageDescription}>{description}</p>
      </div>
      {actions}
    </header>
  )
}
