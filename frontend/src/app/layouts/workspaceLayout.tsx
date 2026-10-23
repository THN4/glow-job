import { useLayoutEffect, useRef, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WorkspaceSidebar } from '../../features/workspace/components/WorkspaceSidebar'
import { useCurrentRoadmap } from '../../features/roadmap/useCurrentRoadmap'
import { toRoadmapScreen } from '../../features/roadmap/adapter'
import { useCareerGoal } from '../../features/roadmap/useCareerGoal'
import { useSavedProfile } from '../../features/resume/useSavedProfile'
import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../../features/workspace/type'

type WorkspaceLayoutProps = {
  marketUpdate: MarketUpdate
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceLayout({
  marketUpdate,
  onHelpClick,
  onProfileClick,
}: WorkspaceLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const roadmap = useCurrentRoadmap()
  const savedProfile = useSavedProfile()
  const careerGoal = useCareerGoal()
  const targetRole = careerGoal.data?.targetRoleTitle?.trim() || roadmap.data?.summary.targetRole?.trim()
  const user: WorkspaceUser = {
    name: savedProfile.data?.profile.personal.fullName?.trim() || 'Your profile',
    subtitle: targetRole ? `Aspiring ${targetRole}` : 'Set your career goal',
  }
  const isRoadmapPage = pathname.startsWith('/app/roadmap')
  const scrollRef = useRef<HTMLDivElement>(null)
  // Every page shares this scroll box, so start each page at the top. Without this the roadmap page,
  // which cannot scroll, keeps the previous page's offset and shows up cut off.
  useLayoutEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [pathname])
  const currentGoal: CurrentGoalSummary = roadmap.data
    ? toRoadmapScreen(roadmap.data).goal
    : {
      title: roadmap.isPending ? 'Loading your goal…' : roadmap.isError ? 'Goal unavailable' : 'No roadmap yet',
      progress: 0,
      statusText: roadmap.isPending ? 'Loading progress…' : roadmap.isError ? 'Could not load progress' : 'Create your roadmap to track progress',
      timeRemaining: '',
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
        <div ref={scrollRef} className={`min-h-0 flex-1 ${isRoadmapPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
