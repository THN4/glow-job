import type { LucideIcon } from 'lucide-react'

export type WorkspaceNavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export type CurrentGoalSummary = {
  title: string
  progress: number
  statusText: string
  timeRemaining: string
}

export type MarketUpdate = {
  title: string
  summary: string
}

export type WorkspaceUser = {
  name: string
  subtitle: string
  avatarUrl?: string
}