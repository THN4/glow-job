import type { ReactNode } from 'react'
import { Badge } from '../ui/badge'

export function SkillChip({ children }: { children: ReactNode }) {
  return <Badge variant="secondary" className="h-7 px-2.5 text-sm font-normal">{children}</Badge>
}
