import { createBrowserRouter, Navigate } from 'react-router-dom'
import { WorkspaceLayout } from './layouts/workspaceLayout'
import {
  workspaceGoal,
  workspaceMarketUpdate,
  workspaceUser,
} from '../features/workspace/data/workspaceMockData'
import { WorkspacePlaceholderPage } from '../features/workspace/pages/WorkspacePlaceholderPage'
import { RoadmapPage } from '../features/roadmap/pages/RoadmapPage'
import { SkillProfilePage } from '../features/skill-profile/pages/SkillProfilePage'
import { ApplicationsPage } from '../features/applications/pages/ApplicationsPage'
import { CvOnboardingPage } from '../features/resume/pages/CvOnboardingPage'

const router = createBrowserRouter([
  {
    path: '/onboarding/cv',
    element: <CvOnboardingPage />,
  },
  {
    path: '/',
    element: <Navigate to="/app/roadmap" replace />,
  },
  {
    path: '/app',
    element: (
      <WorkspaceLayout
        goal={workspaceGoal}
        marketUpdate={workspaceMarketUpdate}
        user={workspaceUser}
        onViewInsights={() => {}}
        onHelpClick={() => {}}
        onProfileClick={() => {}}
      />
    ),
    children: [
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
        path: '*',
        element: <WorkspacePlaceholderPage />,
      },
    ],
  },
])

export default router
