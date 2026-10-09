import { Outlet, useLocation } from 'react-router-dom'
import { WorkspaceSidebar } from '../../features/workspace/components/WorkspaceSidebar'
import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../../features/workspace/type'

type WorkspaceLayoutProps = {
  goal: CurrentGoalSummary
  marketUpdate: MarketUpdate
  user: WorkspaceUser
  onViewInsights: () => void
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceLayout({
  goal,
  marketUpdate,
  user,
  onViewInsights,
  onHelpClick,
  onProfileClick,
}: WorkspaceLayoutProps) {
  const { pathname } = useLocation()
  const isRoadmapPage = pathname.startsWith('/app/roadmap')

  return (
    <div className="flex h-dvh overflow-hidden bg-sky-50">
      <WorkspaceSidebar
        goal={goal}
        marketUpdate={marketUpdate}
        user={user}
        onViewInsights={onViewInsights}
        onHelpClick={onHelpClick}
        onProfileClick={onProfileClick}
      />

      <main
        className={`min-h-0 min-w-0 flex-1 ${
          isRoadmapPage ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <div
          className={`mx-auto w-full max-w-[1500px] p-4 sm:p-6 ${
            isRoadmapPage ? 'flex h-full min-h-0 flex-col' : 'min-h-screen'
          }`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
