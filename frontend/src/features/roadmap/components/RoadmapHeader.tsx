import { workspaceStyles } from '../../workspace/workspaceStyles'
import type { RoadmapSummary } from '../type'

type RoadmapHeaderProps = {
  summary: RoadmapSummary
}

export function RoadmapHeader({ summary }: RoadmapHeaderProps) {
  return (
    <header className="relative mb-3 shrink-0 text-center sm:mb-5 [@media(max-height:760px)]:mb-2">
      <h1 className={workspaceStyles.pageTitle}>
        Your Career Roadmap
      </h1>
      <p className={workspaceStyles.pageDescription}>
        {summary.targetRole} · {summary.duration} · Click any step to explore
      </p>
    </header>
  )
}
