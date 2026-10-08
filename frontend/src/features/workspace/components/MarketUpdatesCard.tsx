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
    <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex items-start gap-2">
        <span className="relative mt-0.5 text-amber-500">
          <Bell size={18} aria-hidden="true" />
          {isNew && (
            <span className="absolute -right-2 -top-1 rounded bg-red-500 px-1 text-[8px] font-bold leading-3 text-white">
              NEW
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-semibold text-blue-700">
            Market Updates
          </h2>

          <p className="mt-1 text-[10px] leading-4 text-slate-600 [@media(max-height:900px)]:hidden">
            {update.summary}
          </p>

          <button
            type="button"
            onClick={onViewInsights}
            className="mt-1 inline-flex min-h-8 items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800"
          >
            View insights
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
