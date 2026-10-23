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
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{context}</p>
        <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]">{title}</h1>
        {detailTitle && <h2 className="mt-3 text-lg font-semibold text-foreground">{detailTitle}</h2>}
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {actions}
    </header>
  )
}
