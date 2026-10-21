import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

const colors = {
  blue: 'bg-icon-blue text-primary',
  green: 'bg-icon-green text-success',
  purple: 'bg-icon-purple text-info',
  pink: 'bg-icon-pink text-pink',
  amber: 'bg-icon-amber text-warning',
  teal: 'bg-icon-teal text-teal',
} as const

export type IconColor = keyof typeof colors

export function IconBox({ icon: Icon, color = 'blue', className }: {
  icon: LucideIcon
  color?: IconColor
  className?: string
}) {
  return <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', colors[color], className)}>
    <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
  </span>
}
