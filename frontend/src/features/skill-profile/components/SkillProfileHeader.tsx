import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

type SkillProfileHeaderProps = {
  targetRole: string
  duration: string
}

export function SkillProfileHeader({ targetRole, duration }: SkillProfileHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">
          {targetRole} · {duration}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Skill Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Track your learning progress and supporting evidence along your roadmap.
        </p>
      </div>
      <Link
        to="/app/roadmap"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
      >
        View my roadmap
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </header>
  )
}
