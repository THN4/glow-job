import { StatusIcon } from '../../../components/StatusIcon'
import { BriefcaseBusiness, Code2, Package, Star } from 'lucide-react'
import { CurrentStepBorder } from './CurrentStepBorder'
import { nodeIconColors } from '../nodeAppearance'
const typeItems = [
  { label: 'Skill', icon: Code2, color: nodeIconColors.skill },
  { label: 'Project', icon: Package, color: nodeIconColors.project },
  { label: 'Career Activity', icon: BriefcaseBusiness, color: nodeIconColors['career-activity'] },
  { label: 'Goal', icon: Star, color: nodeIconColors.goal },
]
const legendItems = [
  { kind: 'completed' as const, label: 'Completed', color: 'text-emerald-600' },
  { kind: 'in-progress' as const, label: 'In progress', color: 'text-blue-600' },
  { kind: 'upcoming' as const, label: 'Upcoming', color: 'text-slate-500' },
]

export function RoadmapLegend() {
  return (
    <div className="text-[11px] leading-4 text-slate-600">
      <div role="group" aria-label="Step types" className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5">
        {typeItems.map(({ label, icon: Icon, color }) => (
          <span key={label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${color}`}>
              <Icon size={12} aria-hidden="true" />
            </span>
            {label}
          </span>
        ))}
      </div>
      <div role="group" aria-label="Progress statuses" className="mt-2 grid grid-cols-2 items-center gap-x-3 gap-y-1.5 border-t border-border pt-2">
        {legendItems.map(({ kind, label, color }) => (
          <span key={kind} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <StatusIcon status={kind} size={14} className={`shrink-0 ${color}`} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="relative inline-flex h-4 w-6 shrink-0 rounded-xl bg-blue-50">
            <CurrentStepBorder />
          </span>
          Current step
        </span>
      </div>
    </div>
  )
}
