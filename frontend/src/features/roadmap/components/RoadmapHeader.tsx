import type { RoadmapSummary } from '../type'
import { RoadmapLegend } from './RoadmapLegend'
import { RoadmapProgressBadge } from './RoadmapProgressBadge'

type RoadmapHeaderProps = {
  summary: RoadmapSummary
  showProgress?: boolean
}

export function RoadmapHeader({ summary, showProgress = true }: RoadmapHeaderProps) {
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
      <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
        Your Career Roadmap
      </h1>
      <p className="mt-1 text-xs text-blue-700/80 sm:text-sm">
        {summary.targetRole} · {summary.duration} · Click any step to explore
      </p>
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
