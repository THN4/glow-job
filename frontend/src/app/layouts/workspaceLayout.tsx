import { useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WorkspaceSidebar } from '../../features/workspace/components/WorkspaceSidebar'
import { useRoadmapCounts } from '../../features/roadmap/useRoadmapCounts'
import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../../features/workspace/type'

type WorkspaceLayoutProps = {
  goal: CurrentGoalSummary
  marketUpdate: MarketUpdate
  user: WorkspaceUser
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceLayout({
  goal,
  marketUpdate,
  user,
  onHelpClick,
  onProfileClick,
}: WorkspaceLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const roadmap = useRoadmapCounts()
  const isRoadmapPage = pathname.startsWith('/app/roadmap')
  const currentGoal = {
    ...goal,
    progress: roadmap.completionPercent,
    statusText: roadmap.completionPercent === 100 ? 'Completed' : roadmap.completionPercent === 0 ? 'Ready to start' : 'On track',
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        goal={currentGoal}
        marketUpdate={marketUpdate}
        user={user}
        onViewInsights={() => navigate('/app/market-insights')}
        onHelpClick={onHelpClick}
        onProfileClick={onProfileClick}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!isSidebarOpen && <div className="hidden shrink-0 items-center px-4 pt-3 sm:px-6 sidebar-expanded:flex">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            aria-expanded={isSidebarOpen}
            aria-controls="workspace-sidebar"
            title="Open sidebar"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-white text-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PanelLeftOpen size={20} aria-hidden="true" />
          </button>
        </div>}
        <div className={`min-h-0 flex-1 ${isRoadmapPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            className={`mx-auto w-full max-w-[1500px] p-4 sm:p-6 ${
              isRoadmapPage ? 'flex h-full min-h-0 flex-col' : 'min-h-screen'
            }`}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
