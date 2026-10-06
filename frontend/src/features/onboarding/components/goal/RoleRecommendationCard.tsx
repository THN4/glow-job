import { Code2, Layers, Settings, TrendingUp } from 'lucide-react'
import { IconBox } from '../../../../components/shared/IconBox'
import { StatusTag } from '../../../../components/shared/StatusTag'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { goalCopy } from '../../../../lib/goalConstants'
import { cn } from '../../../../lib/utils'
import type { RoleRecommendation } from '../../types'

const icons = { development: Code2, full_stack: Layers, infrastructure: Settings }
const demandVariants = { high: 'success', growing: 'neutral', steady: 'warning' } as const

export function RoleRecommendationCard({ role, selected, onSelect }: {
  role: RoleRecommendation; selected: boolean; onSelect: () => void
}) {
  return (
    <Button type="button" variant="outline" aria-pressed={selected} onClick={onSelect}
      className={cn('h-auto min-h-47 min-w-0 flex-col items-stretch justify-between gap-2 whitespace-normal rounded-2xl border-border bg-card px-4 py-3 text-left text-sm font-normal shadow-none hover:border-primary/50 hover:bg-accent',
        selected && 'border-primary bg-accent ring-1 ring-primary')}>
      <span className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1">
        <IconBox icon={icons[role.category]} color={role.category === 'full_stack' ? 'blue' : 'purple'} className="row-span-2" />
        <span className="min-w-0 font-semibold leading-5 text-foreground">{role.title}</span>
        <Badge variant="secondary" className="h-8 bg-icon-green px-3 text-base font-semibold text-success">
          {goalCopy.recommendations.matchPercent(role.matchPercent)}
        </Badge>
        <span className="col-span-2 col-start-2 text-right text-sm leading-5 text-muted-foreground">{goalCopy.recommendations.profileMatch}</span>
      </span>
      <span className="block leading-[1.3] text-muted-foreground">{role.description}</span>
      <StatusTag icon={TrendingUp} variant={demandVariants[role.demand]} className="h-8 self-start px-4">
        {goalCopy.recommendations.demand[role.demand]}
      </StatusTag>
    </Button>
  )
}
