import type { LucideProps } from 'lucide-react'
import { statusIcons } from './statusIcons'

export function StatusIcon({ status, size = 14, ...props }: LucideProps & { status: keyof typeof statusIcons }) {
  const Icon = statusIcons[status]
  return <Icon size={size} aria-hidden="true" {...props} />
}
