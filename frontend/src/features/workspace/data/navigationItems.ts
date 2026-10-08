import {
  BriefcaseBusiness,
  ChartLine,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  UserRound,
} from 'lucide-react'
import type { WorkspaceNavItem } from '../type'

export const workspaceNavigationItems: WorkspaceNavItem[] = [
  { label: 'Overview', href: '/app/overview', icon: LayoutDashboard },
  { label: 'My Roadmap', href: '/app/roadmap', icon: GitBranch },
  { label: 'Skill Profile', href: '/app/skill-profile', icon: UserRound },
  { label: 'Market Insights', href: '/app/market-insights', icon: ChartLine },
  { label: 'Applications', href: '/app/applications', icon: BriefcaseBusiness },
  { label: 'Progress', href: '/app/progress', icon: ChartLine },
  { label: 'Assessments', href: '/app/assessments', icon: ClipboardCheck },
]
