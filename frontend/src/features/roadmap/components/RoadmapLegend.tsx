import type { RoadmapNodeKind } from '../type'

const legendItems: { kind: RoadmapNodeKind | 'upcoming'; label: string; color: string }[] = [
  { kind: 'skill', label: 'Skill', color: 'bg-blue-600' },
  { kind: 'project', label: 'Project', color: 'bg-emerald-500' },
  { kind: 'career-activity', label: 'Career Activity', color: 'bg-orange-500' },
  { kind: 'upcoming', label: 'Upcoming', color: 'border border-slate-400 bg-white' },
]

export function RoadmapLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9px] text-slate-500 sm:gap-x-5 sm:gap-y-2 sm:text-[11px]">
      {legendItems.map(({ kind, label, color }) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
          {label}
        </span>
      ))}
      <span className="hidden items-center gap-1.5 min-[640px]:inline-flex">
        <span className="w-5 border-t border-dashed border-slate-400" aria-hidden="true" />
        Optional path
      </span>
    </div>
  )
}
