import { CurrentGoalCard } from './CurrentGoalCard'
import { MarketUpdatesCard } from './MarketUpdatesCard'
import { WorkspaceAccountFooter } from './WorkspaceAccountFooter'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../type'

type WorkspaceSidebarProps = {
  goal: CurrentGoalSummary
  marketUpdate: MarketUpdate
  user: WorkspaceUser
  onViewInsights: () => void
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceSidebar({
  goal,
  marketUpdate,
  user,
  onViewInsights,
  onHelpClick,
  onProfileClick,
}: WorkspaceSidebarProps) {
  return (
    <aside className="hidden h-dvh w-[220px] shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white px-3 py-4 lg:flex [@media(max-height:900px)]:py-3">
      <div className="px-1">
        <p className="text-xl font-bold tracking-tight text-slate-900">
          Glow<span className="text-blue-600">Job</span>
        </p>
        <p className="text-[8px] font-medium uppercase tracking-wide text-slate-400">
          AI Navigation
        </p>
      </div>

      <div className="mt-5 shrink-0 [@media(max-height:900px)]:mt-3">
        <CurrentGoalCard goal={goal} />
      </div>

      <WorkspaceNavigation />

      <div className="mt-auto shrink-0 pt-5 [@media(max-height:900px)]:pt-2">
        <div className="[@media(max-height:760px)]:hidden">
          <MarketUpdatesCard
            update={marketUpdate}
            onViewInsights={onViewInsights}
            isNew
          />
        </div>
        <div className="mt-3 [@media(max-height:900px)]:mt-1">
          <WorkspaceAccountFooter
            user={user}
            onHelpClick={onHelpClick}
            onProfileClick={onProfileClick}
          />
        </div>
      </div>
    </aside>
  )
}
