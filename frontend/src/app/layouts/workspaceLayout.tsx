import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PanelLeftOpen } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WorkspaceSidebar } from '../../features/workspace/components/WorkspaceSidebar'
import { getSavedProfileId, loadSavedProfile } from '../../features/resume/api'
import { useCurrentRoadmap } from '../../features/roadmap/useCurrentRoadmap'
import { applicationsApi } from '../../features/applications/api'
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
  const profileId = getSavedProfileId()
  const { data: roadmap } = useCurrentRoadmap()
  const { data: savedProfile } = useQuery({
    queryKey: ['saved-profile', profileId],
    queryFn: loadSavedProfile,
    enabled: Boolean(profileId),
  })
  const jobPostingsQuery = useQuery({
    queryKey: ['job-postings'],
    queryFn: applicationsApi.jobPostings,
    staleTime: 5 * 60 * 1000,
  })
  const isRoadmapPage = pathname.startsWith('/app/roadmap')
  const scrollRef = useRef<HTMLDivElement>(null)
  // Every page shares this scroll box, so start each page at the top. Without this the roadmap page,
  // which cannot scroll, keeps the previous page's offset and shows up cut off.
  useLayoutEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [pathname])
  const progress = roadmap?.progress.percent ?? 0
  const currentGoal: CurrentGoalSummary = {
    title: roadmap?.summary.targetRole ?? (profileId ? 'Choose a career goal' : 'Set your career goal'),
    progress,
    statusText: roadmap ? (progress === 100 ? 'Completed' : progress === 0 ? 'Ready to start' : 'In progress')
      : profileId ? 'Roadmap not created' : 'Complete onboarding',
    timeRemaining: roadmap?.summary.timeRemainingLabel ?? 'No target date',
  }
  const fullName = savedProfile?.profile.personal.fullName?.trim()
  const headline = savedProfile?.profile.personal.headline?.trim()
  const user: WorkspaceUser = {
    name: fullName || 'Your profile',
    subtitle: headline || (roadmap ? `Goal: ${roadmap.summary.targetRole}` : 'Complete onboarding to personalize your workspace'),
  }
  const marketUpdate: MarketUpdate = {
    title: 'Job Market',
    summary: jobPostingsQuery.isPending
      ? 'Loading current job openings...'
      : jobPostingsQuery.isError
        ? 'Current job market data is unavailable.'
        : `${jobPostingsQuery.data.length} job openings are available from the database.`,
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
