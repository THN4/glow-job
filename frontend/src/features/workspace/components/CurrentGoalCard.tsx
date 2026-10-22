import type { CurrentGoalSummary } from '../type'

type CurrentGoalCardProps = {
  goal: CurrentGoalSummary
}

export function CurrentGoalCard({ goal }: CurrentGoalCardProps) {
  const progress = Math.max(0, Math.min(100, goal.progress))

  return (
    <section className="rounded-xl border border-border bg-card p-3 [@media(max-height:900px)]:p-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Current goal
      </p>

      <h2 className="mt-1 text-base font-semibold leading-6 text-foreground">
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
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-input/80"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs font-semibold text-primary">
          {progress}%
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground [@media(max-height:900px)]:mt-1">
        {goal.statusText} · {goal.timeRemaining}
      </p>
    </section>
  )
}
