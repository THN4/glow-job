import { Bell, ChevronRight } from 'lucide-react'
import type { MarketUpdate } from '../type'

type MarketUpdatesCardProps = {
  update: MarketUpdate
  onViewInsights: () => void
  isNew?: boolean
}

export function MarketUpdatesCard({
  update,
  onViewInsights,
  isNew = false,
}: MarketUpdatesCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="relative mt-0.5 text-amber-500">
          <Bell size={18} aria-hidden="true" />
          {isNew && (
            <span className="absolute -right-2 -top-1 rounded bg-destructive px-1 text-xs font-bold leading-4 text-white">
              NEW
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-primary">
            Market Updates
          </h2>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {update.summary}
          </p>

          <button
            type="button"
            onClick={onViewInsights}
            className="mt-1 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            View insights
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
