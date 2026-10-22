import type { RoadmapSummary } from '../type'
import { RoadmapLegend } from './RoadmapLegend'
import { RoadmapProgressBadge } from './RoadmapProgressBadge'

type RoadmapHeaderProps = {
  summary: RoadmapSummary
  showProgress?: boolean
  onRegenerate?: () => void
  regenerating?: boolean
}

export function RoadmapHeader({ summary, showProgress = true, onRegenerate, regenerating = false }: RoadmapHeaderProps) {
  return (
    <header className="relative mb-3 shrink-0 px-1 pb-1 text-center sm:mb-5 sm:px-2 [@media(max-height:760px)]:mb-2">
      {showProgress && (
        <div className="absolute right-0 top-0 hidden sm:block">
          <RoadmapProgressBadge
            completion={summary.completion}
            statusText={summary.statusText}
          />
        </div>
      )}
      <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]">
        Your Career Roadmap
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
        {summary.targetRole} · {summary.duration} · Click any step to explore
      </p>
      {onRegenerate && <button type="button" disabled={regenerating} onClick={onRegenerate}
        className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
        {regenerating ? 'Rebuilding roadmap…' : 'Rebuild roadmap'}
      </button>}
      <div className="mt-2 sm:mt-3 [@media(max-height:760px)]:mt-1.5">
        <RoadmapLegend />
      </div>
      {showProgress && (
        <div className="mt-3 sm:hidden [@media(max-height:760px)]:mt-1">
          <RoadmapProgressBadge
            completion={summary.completion}
            statusText={summary.statusText}
          />
        </div>
      )}
    </header>
  )
}
