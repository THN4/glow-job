import { createBrowserRouter, Navigate } from 'react-router-dom'
import { WorkspaceLayout } from './layouts/workspaceLayout'
import {
  workspaceGoal,
  workspaceMarketUpdate,
  workspaceUser,
} from '../features/workspace/data/workspaceMockData'
import { WorkspacePlaceholderPage } from '../features/workspace/pages/WorkspacePlaceholderPage'
import { OverviewPage } from '../features/workspace/pages/OverviewPage'
import { RoadmapPage } from '../features/roadmap/pages/RoadmapPage'
import { SkillProfilePage } from '../features/skill-profile/pages/SkillProfilePage'
import { ApplicationsPage } from '../features/applications/pages/ApplicationsPage'
import { MarketInsightsPage } from '../features/applications/pages/MarketInsightsPage'
import { ProgressPage } from '../features/roadmap/pages/ProgressPage'
import { CvOnboardingPage } from '../features/resume/pages/CvOnboardingPage'
import { OnboardingFlow } from '@/features/onboarding/state/OnboardingFlow'
import { OnboardingProvider } from '@/features/onboarding/state/OnboardingProvider'


const router = createBrowserRouter([
  {
  path: '/onboarding',
  element: (
    <OnboardingProvider>
      <OnboardingFlow />
    </OnboardingProvider>
  ),
},
  {
    path: '/onboarding/cv',
    element: <CvOnboardingPage />,
  },
  {
    path: '/',
    element: <Navigate to="/app/overview" replace />,
  },
  {
    path: '/app',
    element: (
      <WorkspaceLayout
        goal={workspaceGoal}
        marketUpdate={workspaceMarketUpdate}
        user={workspaceUser}
        onHelpClick={() => {}}
        onProfileClick={() => {}}
      />
    ),
    children: [
      {
        path: 'overview',
        element: <OverviewPage />,
      },
      {
        path: 'roadmap',
        element: <RoadmapPage />,
      },
      {
        path: 'skill-profile',
        element: <SkillProfilePage />,
      },
      {
        path: 'applications',
        element: <ApplicationsPage />,
      },
      {
        path: 'progress',
        element: <ProgressPage />,
      },
      {
        path: 'market-insights',
        element: <MarketInsightsPage />,
      },
      {
        path: '*',
        element: <WorkspacePlaceholderPage />,
      },
    ],
  },
])

export default router
