import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

const variants = {
  warning: 'bg-icon-amber text-warning',
  success: 'bg-icon-green text-success',
  info: 'bg-icon-purple text-info',
  neutral: 'bg-secondary text-primary',
} as const

export function StatusTag({ variant = 'neutral', icon: Icon, children, className }: {
  variant?: keyof typeof variants
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return <Badge variant="secondary" className={cn('h-7 gap-1.5 px-3 text-sm font-normal', variants[variant], className)}>
    {Icon && <Icon aria-hidden="true" />}{children}
  </Badge>
}
