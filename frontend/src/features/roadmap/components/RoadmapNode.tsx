import {
  BriefcaseBusiness,
  Check,
  Cloud,
  Code2,
  Package,
  Star,
  Wind,
} from 'lucide-react'
import type { RoadmapNodeData } from '../type'

type RoadmapNodeProps = {
  node: RoadmapNodeData
  width: number | string
  selected: boolean
  onSelect: (node: RoadmapNodeData) => void
}

function renderNodeIcon(node: RoadmapNodeData) {
  const props = { size: 17, strokeWidth: 2.3, 'aria-hidden': true as const }

  if (node.status === 'completed') return <Check {...props} />
  if (node.kind === 'project') return <Package {...props} />
  if (node.kind === 'career-activity') return <BriefcaseBusiness {...props} />
  if (node.kind === 'goal') return <Star {...props} />
  if (node.id === 'airflow') return <Wind {...props} />
  if (node.id === 'deploy-to-cloud') return <Cloud {...props} />
  return <Code2 {...props} />
}

function getNodeStyle(node: RoadmapNodeData, selected: boolean) {
  if (node.kind === 'career-activity' || node.kind === 'goal') {
    return {
      card: 'border-orange-200 bg-orange-50/80',
      icon: 'bg-orange-500 text-white',
      subtitle: 'text-orange-700',
    }
  }

  if (node.kind === 'project') {
    return {
      card: 'border-emerald-200 bg-emerald-50/80',
      icon: 'bg-emerald-500 text-white',
      subtitle: 'text-emerald-700',
    }
  }

  if (node.status === 'in-progress') {
    return {
      card: 'border-blue-500 bg-white shadow-md ring-2 ring-blue-100',
      icon: 'bg-blue-600 text-white',
      subtitle: 'font-medium text-blue-700',
    }
  }

  if (node.status === 'completed') {
    return {
      card: selected
        ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-100'
        : 'border-blue-200 bg-white',
      icon: 'bg-blue-600 text-white',
      subtitle: 'text-blue-700',
    }
  }

  return {
    card: 'border-slate-200 bg-white',
    icon: 'bg-slate-100 text-slate-400',
    subtitle: 'text-slate-500',
  }
}

export function RoadmapNode({ node, width, selected, onSelect }: RoadmapNodeProps) {
  const styles = getNodeStyle(node, selected)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(node)}
        aria-pressed={selected}
        style={{ width }}
        className={`relative z-10 flex h-[50px] shrink-0 items-center gap-2 rounded-2xl border px-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${styles.card} ${selected ? 'ring-2 ring-blue-300' : ''}`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
          {renderNodeIcon(node)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block break-words text-[10px] font-semibold leading-[1.05] text-slate-900 sm:text-[11px]">
            {node.title}
          </span>
          <span className={`mt-0.5 block truncate text-[8px] leading-tight ${styles.subtitle} sm:text-[9px]`}>
            {node.subtitle}
          </span>
        </span>
      </button>
      {node.status === 'in-progress' && (
        <span className="absolute -left-[102px] top-1/2 z-20 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-semibold text-white shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
          YOU ARE HERE
        </span>
      )}
    </div>
  )
}
