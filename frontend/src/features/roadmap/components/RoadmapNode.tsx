import { CurrentStepBorder } from './CurrentStepBorder'
import { StatusIcon } from '../../../components/StatusIcon'
import { RoadmapNodeIcon } from './RoadmapNodeIcon'
import type { RoadmapNodeData } from '../type'
import { nodeIconColors } from '../nodeAppearance'

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
        style={{ width, height: compact ? 48 : 60 }}
        className={`relative z-10 flex h-[60px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${styles.card} ${selected && node.status !== 'in-progress' ? 'ring-2 ring-blue-300' : ''}`}
      >
        {node.status === 'in-progress' && <CurrentStepBorder />}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
          <RoadmapNodeIcon node={node} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block break-words text-[10px] font-semibold leading-[1.05] text-slate-900 sm:text-[11px]">
            {node.title}
          </span>
          <span className={`mt-0.5 flex items-center gap-1 text-[8px] leading-tight ${styles.subtitle} sm:text-[9px]`}>
            <StatusIcon status={node.status} size={10} className="shrink-0" />
            <span className="truncate">{node.subtitle}</span>
          </span>
        </span>
      </button>
    </div>
  )
}
