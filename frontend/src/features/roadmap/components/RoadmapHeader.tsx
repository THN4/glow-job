import { workspaceStyles } from '../../workspace/workspaceStyles'
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
    <header className="relative mb-3 shrink-0 text-center sm:mb-5 [@media(max-height:760px)]:mb-2">
      <h1 className={workspaceStyles.pageTitle}>
        Your Career Roadmap
      </h1>
      <p className={workspaceStyles.pageDescription}>
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
        <div className="mt-3 flex justify-center [@media(max-height:760px)]:mt-1">
          <RoadmapProgressBadge
            completion={summary.completion}
            statusText={summary.statusText}
          />
        </div>
      )}
    </header>
  )
}
