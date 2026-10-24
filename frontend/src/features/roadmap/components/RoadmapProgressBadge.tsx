import { TrendingUp } from 'lucide-react'

type RoadmapProgressBadgeProps = {
  completion: number
  statusText: string
}

export function RoadmapProgressBadge({
  completion,
  statusText,
}: RoadmapProgressBadgeProps) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <TrendingUp size={14} className="shrink-0" aria-hidden="true" />
      <span>{completion}% complete · {statusText}</span>
    </div>
  )
}
