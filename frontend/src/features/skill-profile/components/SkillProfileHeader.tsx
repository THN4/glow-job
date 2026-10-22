import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'

type SkillProfileHeaderProps = {
  targetRole: string
  duration: string
}

export function SkillProfileHeader({ targetRole, duration }: SkillProfileHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {targetRole} · {duration}
        </p>
        <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]">
          Skill Profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          Track your learning progress and supporting evidence along your roadmap.
        </p>
      </div>
      <Link
        to="/app/roadmap"
        aria-label="View my roadmap"
        className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 hover:bg-accent"
      >
        <Map size={22} aria-hidden="true" />
        <span>View</span>
      </Link>
    </header>
  )
}
