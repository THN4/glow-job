import { createBrowserRouter, Navigate } from 'react-router-dom'
import { WorkspaceLayout } from './layouts/workspaceLayout'
import {
  workspaceGoal,
  workspaceMarketUpdate,
  workspaceUser,
} from '../features/workspace/data/workspaceMockData'
import { WorkspacePlaceholderPage } from '../features/workspace/pages/WorkspacePlaceholderPage'

const router = createBrowserRouter([
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
        path: '*',
        element: <WorkspacePlaceholderPage />,
      },
    ],
  },
])

export default router
