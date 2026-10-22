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
    <section aria-label="News alerts" className="relative overflow-hidden rounded-lg border border-blue-200 bg-blue-50 p-2.5 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
          <Bell size={16} aria-hidden="true" />
          {isNew && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <h2 className="text-xs font-bold text-slate-900">News alerts</h2>
            {isNew && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">New</span>}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-700">{update.summary}</p>
      <button
        type="button"
        onClick={onViewInsights}
        className="mt-1.5 inline-flex min-h-8 items-center gap-1 rounded-md border border-blue-200 bg-white px-2 text-[11px] font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        View insights
        <ChevronRight size={13} aria-hidden="true" />
      </button>
    </section>
  )
}
