import { Bookmark, CircleCheck, CircleDot, CircleX, Clock3, MessageCircle, Search, Send, type LucideIcon } from 'lucide-react'
import type { ApplicationStatus } from '../features/applications/type'
import type { RoadmapNodeStatus } from '../features/roadmap/type'

/** Use state icons for status; keep skill, project, and action icons separate. */
export const learningStatusIcons = {
  completed: CircleCheck,
  'in-progress': CircleDot,
  upcoming: Clock3,
} satisfies Record<RoadmapNodeStatus, LucideIcon>

export const applicationStatusIcons = {
  wishlist: Bookmark,
  applied: Send,
  screening: Search,
  interview: MessageCircle,
  offer: CircleCheck,
  rejected: CircleX,
} satisfies Record<ApplicationStatus, LucideIcon>

export const statusIcons = { ...learningStatusIcons, ...applicationStatusIcons }
