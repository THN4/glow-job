import { CurrentStepBorder } from './CurrentStepBorder'
import { StatusIcon } from '../../../components/StatusIcon'
import { RoadmapNodeIcon } from './RoadmapNodeIcon'
import type { RoadmapNodeData } from '../type'
import { nodeIconColors } from '../nodeAppearance'
import { ROADMAP_NODE_HEIGHT } from '../graphLayout'

type RoadmapNodeProps = {
  node: RoadmapNodeData
  width: number | string
  selected: boolean
  compact?: boolean
  onSelect: (node: RoadmapNodeData) => void
}

function getNodeStyle(node: RoadmapNodeData) {
  const icon = nodeIconColors[node.kind]
  if (node.learningContentAvailable === false) {
    return {
      card: 'border-dashed border-slate-300 bg-slate-100 opacity-60',
      icon: 'bg-slate-200 text-slate-500',
      subtitle: 'font-medium text-slate-500',
    }
  }
  if (node.status === 'completed') {
    return {
      card: 'border-emerald-500 bg-emerald-100',
      icon,
      subtitle: 'text-emerald-700',
    }
  }
  if (node.status === 'in-progress') {
    return {
      card: 'border-transparent bg-blue-50 shadow-md',
      icon,
      subtitle: 'font-medium text-blue-700',
    }
  }
  return {
    card: 'border-slate-400 bg-slate-200',
    icon,
    subtitle: 'text-slate-500',
  }
}

export function RoadmapNode({ node, width, selected, onSelect, compact = false }: RoadmapNodeProps) {
  const styles = getNodeStyle(node)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(node)}
        aria-pressed={selected}
        aria-current={node.status === 'in-progress' ? 'step' : undefined}
        style={{ width, height: compact ? undefined : ROADMAP_NODE_HEIGHT }}
        className={`relative z-10 flex shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${compact ? 'min-h-[76px] py-3' : ''} ${styles.card} ${selected && node.status !== 'in-progress' ? 'ring-2 ring-blue-300' : ''}`}
      >
        {node.status === 'in-progress' && <CurrentStepBorder />}
        <span className={`flex shrink-0 items-center justify-center rounded-full ${compact ? 'size-10' : 'size-8'} ${styles.icon}`}>
          <RoadmapNodeIcon node={node} size={compact ? 24 : 20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block line-clamp-2 break-words font-semibold text-slate-900 ${compact ? 'text-sm leading-5' : 'text-[13px] leading-4'}`}>
            {node.title}
          </span>
          <span className={`mt-1 flex items-center gap-1 leading-4 ${compact ? 'text-xs' : 'text-[11px]'} ${styles.subtitle}`}>
            <StatusIcon status={node.status} size={compact ? 12 : 11} className="shrink-0" />
            <span className="truncate">{node.subtitle}</span>
          </span>
        </span>
      </button>
    </div>
  )
}
