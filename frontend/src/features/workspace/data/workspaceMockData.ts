import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../type'
import { roadmapSummary } from '../../roadmap/data/roadmapMockData'

export const workspaceGoal: CurrentGoalSummary = {
  title: roadmapSummary.targetRole,
  progress: 64,
  statusText: 'On track',
  timeRemaining: '4 months remaining',
}

export const workspaceMarketUpdate: MarketUpdate = {
  title: 'Market Updates',
  summary: 'Explore skills and roles across the sample internship openings.',
}

export const workspaceUser: WorkspaceUser = {
  name: 'Alex Johnson',
  subtitle: 'Aspiring data engineer',
}
