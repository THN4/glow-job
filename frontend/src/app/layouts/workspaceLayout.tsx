import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { applicationsApi } from '../../features/applications/api'
import { PanelLeftOpen } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WorkspaceSidebar } from '../../features/workspace/components/WorkspaceSidebar'
import { WorkspaceMobileSidebar } from '../../features/workspace/components/WorkspaceMobileSidebar'
import { useExpandedSidebar } from '../../features/workspace/useExpandedSidebar'
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
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceLayout({
  onHelpClick,
  onProfileClick,
}: WorkspaceLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isSidebarExpanded = useExpandedSidebar()
  const roadmap = useCurrentRoadmap()
  const savedProfile = useSavedProfile()
  const careerGoal = useCareerGoal()
  const targetRole = careerGoal.data?.targetRoleTitle?.trim() || roadmap.data?.summary.targetRole?.trim()
  const user: WorkspaceUser = {
    name: savedProfile.data?.profile.personal.fullName?.trim() || 'Your profile',
    subtitle: targetRole ? `Aspiring ${targetRole}` : 'Set your career goal',
  }
  const jobPostingsQuery = useQuery({
    queryKey: ['job-postings'],
    queryFn: applicationsApi.jobPostings,
    staleTime: 5 * 60 * 1000,
  })
  const marketUpdate: MarketUpdate = {
    title: 'Job Market',
    summary: jobPostingsQuery.isPending
      ? 'Loading current job openings...'
      : jobPostingsQuery.isError
        ? 'Current job market data is unavailable.'
        : `${jobPostingsQuery.data.length} job openings are available from the database.`,
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
        {(!isSidebarExpanded || !isSidebarOpen) && <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30">
          {!isSidebarExpanded ? <WorkspaceMobileSidebar
            goal={currentGoal} marketUpdate={marketUpdate} user={user}
            onViewInsights={() => navigate('/app/market-insights')}
            onHelpClick={onHelpClick} onProfileClick={onProfileClick}
          /> : <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            aria-expanded={isSidebarOpen}
            aria-controls="workspace-sidebar"
            title="Open sidebar"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-white text-foreground shadow-md transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PanelLeftOpen size={20} aria-hidden="true" />
          </button>}
        </div>}
        <div ref={scrollRef} className={`scrollbar-subtle min-h-0 min-w-0 flex-1 ${isRoadmapPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            className={`mx-auto w-full max-w-[1500px] p-4 sm:p-6 ${
              isRoadmapPage ? 'flex h-full min-h-0 min-w-0 flex-col' : `min-h-full ${!isSidebarExpanded || !isSidebarOpen ? 'pb-20' : ''}`
            }`}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
