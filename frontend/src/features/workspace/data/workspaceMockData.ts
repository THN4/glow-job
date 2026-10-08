import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../type'

export const workspaceGoal: CurrentGoalSummary = {
  title: 'Data Engineer Internship',
  progress: 64,
  statusText: 'On track',
  timeRemaining: '4 months remaining',
}

export const workspaceMarketUpdate: MarketUpdate = {
  title: 'Market Updates',
  summary: 'Data engineering internships are up 18% this month.',
}

export const workspaceUser: WorkspaceUser = {
  name: 'Alex Johnson',
  subtitle: 'Aspiring data engineer',
}
