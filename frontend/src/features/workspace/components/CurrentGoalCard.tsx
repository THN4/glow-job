import type { CurrentGoalSummary } from '../type'

type CurrentGoalCardProps = {
  goal: CurrentGoalSummary
}

export function CurrentGoalCard({ goal }: CurrentGoalCardProps) {
  const progress = Math.max(0, Math.min(100, goal.progress))

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 [@media(max-height:900px)]:p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">
        Current goal
      </p>

      <h2 className="mt-1 text-sm font-semibold text-slate-900 [@media(max-height:900px)]:text-[13px]">
        {goal.title}
      </h2>

      <div className="mt-2 flex items-center gap-2 [@media(max-height:900px)]:mt-1.5">
        <div
          role="progressbar"
          aria-label="Career goal progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${progress}% complete`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-100"
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-[11px] font-semibold text-blue-700">
          {progress}%
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 [@media(max-height:900px)]:mt-1">
        {goal.statusText} · {goal.timeRemaining}
      </p>
    </section>
  )
}
