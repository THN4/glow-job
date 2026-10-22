import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleDot,
  Clock3,
  Layers3,
  Star,
  Target,
  Zap,
} from 'lucide-react'
import { loadSavedCareerMatch, type CareerMatchResult, type SavedCareerGoal } from '../../resume/api'

const metrics = [
  { key: 'coreSkillMatchPct', label: 'Core Top 20 coverage', detail: 'Weighted top skills · cutoff ties included', icon: Target, tone: 'blue' },
  { key: 'marketSkillCoveragePct', label: 'All career skills coverage', detail: 'All usable market skills', icon: CircleCheck, tone: 'green' },
  { key: 'proficiencyAlignmentPct', label: 'Proficiency alignment', detail: 'Weighted level match where assessed', icon: Layers3, tone: 'amber' },
  { key: 'assessmentCoveragePct', label: 'Assessment coverage', detail: 'Share of market weight assessed', icon: Clock3, tone: 'purple' },
] as const

const milestones = [
  { label: 'Python', state: 'complete' },
  { label: 'SQL', state: 'complete' },
  { label: 'ETL', state: 'complete' },
  { label: 'Docker', state: 'current' },
  { label: 'Airflow', state: 'upcoming' },
  { label: 'Cloud', state: 'upcoming' },
  { label: 'Goal', state: 'goal' },
] as const

function MetricCard({ metric, value }: { metric: (typeof metrics)[number]; value: number | null }) {
  const Icon = metric.icon
  const formattedValue = value === null ? '—' : `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`

  return (
    <article className="flex min-h-[120px] flex-col rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm sm:min-h-[132px] sm:py-4">
      <Icon className={`size-5 ${metric.tone === 'blue' ? 'text-blue-600' : metric.tone === 'green' ? 'text-emerald-600' : metric.tone === 'amber' ? 'text-amber-500' : 'text-violet-500'}`} aria-hidden="true" />
      <p className={`mt-2 text-2xl font-bold leading-none tracking-tight ${metric.tone === 'blue' ? 'text-blue-600' : metric.tone === 'green' ? 'text-emerald-600' : metric.tone === 'amber' ? 'text-amber-500' : 'text-violet-500'}`}>
        {formattedValue}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-700">{metric.label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{metric.detail}</p>
      <div
        role="progressbar"
        aria-label={metric.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={`${formattedValue} · ${metric.detail}`}
        className="mt-auto h-1.5 overflow-hidden rounded-full bg-blue-100"
      >
        <div className={`h-full rounded-full transition-all ${metric.tone === 'blue' ? 'bg-blue-600' : metric.tone === 'green' ? 'bg-emerald-500' : metric.tone === 'amber' ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </article>
  )
}

export function OverviewPage() {
  const [careerMatch, setCareerMatch] = useState<{ goal: SavedCareerGoal; match: CareerMatchResult } | null>(null)
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [matchError, setMatchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadSavedCareerMatch().then((result) => {
      if (active) setCareerMatch(result)
    }).catch((error: unknown) => {
      if (active) setMatchError(error instanceof Error ? error.message : 'Unable to load career match scores.')
    }).finally(() => {
      if (active) setLoadingMatch(false)
    })
    return () => { active = false }
  }, [])

  const match = careerMatch?.match
  const scores = match?.scores
  const skillSummary = match?.skillSummary

  return (
    <section aria-labelledby="overview-title" className="mx-auto w-full max-w-[1500px] space-y-5 pb-6 sm:space-y-6">
      <header className="relative overflow-hidden py-1 sm:py-2">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 size-64 rounded-full bg-blue-100/45 sm:-right-2 sm:-top-40 sm:size-80" />
        <p className="relative text-[11px] font-semibold uppercase tracking-wide text-blue-600 sm:text-xs">Good morning, Alex · September 18</p>
        <h1 id="overview-title" className="relative mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{careerMatch?.goal.targetRoleTitle ?? 'Career Overview'}</h1>
        <p className="relative mt-1 text-sm text-slate-500 sm:text-base">
          {careerMatch ? `Target: ${careerMatch.goal.readinessTimeframe.replaceAll('_', ' ')} · Career match scores are based on your confirmed profile.` : 'Career match scores are based on your confirmed profile and target role.'}
        </p>
      </header>

      <section aria-labelledby="career-match-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="career-match-title" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Career Match</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Scores use separate market skill sets and describe profile coverage, not job readiness.</p>
          </div>
          {match && <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${match.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{match.status === 'ready' ? 'Market data ready' : 'Estimated · review notes'}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} value={scores?.[metric.key] ?? null} />)}
        </div>
        {loadingMatch && <p role="status" className="text-xs text-slate-500">Loading your career match…</p>}
        {!loadingMatch && matchError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{matchError}</p>}
        {!loadingMatch && !matchError && !careerMatch && <p className="rounded-lg border border-blue-100 bg-white/70 px-4 py-3 text-xs text-slate-600">Complete onboarding and choose a target role available in the career catalog to calculate these scores.</p>}
        {skillSummary && careerMatch && <div aria-label="Profile skills and availability" className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-blue-100 bg-white/70 px-4 py-2.5 text-xs text-slate-600">
          <span><strong className="font-semibold text-slate-900">{skillSummary.covered} / {skillSummary.considered}</strong> market skills in profile</span>
          <span><strong className="font-semibold text-slate-900">{skillSummary.missingFromProfile}</strong> skills missing</span>
          {careerMatch.goal.availableHoursPerWeek !== null && <span><strong className="font-semibold text-slate-900">{careerMatch.goal.availableHoursPerWeek} hrs</strong> per week</span>}
        </div>}
        {match?.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700">{warning}</p>)}
      </section>

      <article className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-sky-50 to-blue-100/80 p-4 shadow-sm sm:p-5 lg:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 size-72 rounded-full border-[32px] border-white/45" />
        <div className="relative max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <Zap className="size-4" aria-hidden="true" /> Your best next action
          </p>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">Add Docker to your existing ETL project</h2>
          <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-500 sm:leading-6">
            Your ETL pipeline is production-quality — containerizing it is the single highest-impact step you can take right now. It strengthens your technical profile and shows real-world deployment skills that employers look for.
          </p>
          <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 sm:grid-cols-3 sm:border-0 sm:pt-0">
            <div className="border-blue-100 sm:border-r sm:pr-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">Docker appears in 78% of Data Engineer postings. It unlocks both Airflow and Cloud on your roadmap.</p>
            </div>
            <div className="border-blue-100 sm:border-r sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated time</p>
              <p className="mt-1 text-xl font-bold text-slate-900">2 weeks</p>
              <p className="text-xs text-slate-500 sm:text-sm">at 8 hrs/week</p>
            </div>
            <div className="sm:pl-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skill evidence gained</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">Containerized pipeline on GitHub and portfolio-ready deployable project.</p>
            </div>
          </div>
          <Link to="/app/roadmap" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Start this action <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Career Roadmap</h2>
          <Link to="/app/roadmap" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-800 sm:text-sm">
            Open full roadmap <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-5 overflow-x-auto">
          <ol aria-label="Career roadmap progress" className="flex min-w-[700px] items-start px-2 pb-2 sm:min-w-0 sm:px-0">
            {milestones.map((milestone, index) => {
              const complete = milestone.state === 'complete'
              const current = milestone.state === 'current'
              const goal = milestone.state === 'goal'
              return (
                <li key={milestone.label} className="relative flex flex-1 flex-col items-center text-center">
                  {index > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-5 h-px w-full ${complete || current ? 'bg-blue-300' : 'bg-slate-200'}`} />}
                  <span className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 ${complete ? 'border-blue-500 bg-blue-500 text-white' : current ? 'border-blue-500 bg-blue-600 text-white ring-4 ring-blue-100' : goal ? 'border-amber-500 bg-amber-500 text-white' : 'border-blue-200 bg-slate-50 text-blue-300'}`}>
                    {complete ? <Check className="size-4" aria-hidden="true" /> : current ? <CircleDot className="size-4" aria-hidden="true" /> : goal ? <Star className="size-4" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={`mt-2 text-xs ${current ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>{milestone.label}{goal && <Star className="ml-1 inline size-3" aria-label="Goal" />}</span>
                </li>
              )
            })}
          </ol>
        </div>
      </article>
    </section>
  )
}
