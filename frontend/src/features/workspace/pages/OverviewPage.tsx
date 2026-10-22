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
import { workspaceGoal } from '../data/workspaceMockData'

const metrics = [
  { label: 'Career Readiness', value: `${workspaceGoal.progress}%`, icon: Target, tone: 'blue', progress: workspaceGoal.progress },
  { label: 'Skills Completed', value: '3 / 6', icon: CircleCheck, tone: 'green' },
  { label: 'Skills to Build', value: '3', icon: Layers3, tone: 'amber' },
  { label: 'Weekly Hours', value: '8 hrs', icon: Clock3, tone: 'purple' },
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

function MetricCard({ metric }: { metric: (typeof metrics)[number] }) {
  const Icon = metric.icon
  const isReadiness = metric.label === 'Career Readiness'

  return (
    <article className="flex min-h-[104px] flex-col rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm sm:min-h-[116px] sm:py-4">
      <Icon className={`size-5 ${metric.tone === 'blue' ? 'text-blue-600' : metric.tone === 'green' ? 'text-emerald-600' : metric.tone === 'amber' ? 'text-amber-500' : 'text-violet-500'}`} aria-hidden="true" />
      <p className={`mt-2 text-2xl font-bold leading-none tracking-tight ${metric.tone === 'blue' ? 'text-blue-600' : metric.tone === 'green' ? 'text-emerald-600' : metric.tone === 'amber' ? 'text-amber-500' : 'text-violet-500'}`}>
        {metric.value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
      {isReadiness && (
        <div
          role="progressbar"
          aria-label="Career readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metric.progress}
          aria-valuetext={`${metric.progress}% ready`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100"
        >
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${metric.progress}%` }} />
        </div>
      )}
    </article>
  )
}

export function OverviewPage() {
  return (
    <section aria-labelledby="overview-title" className="mx-auto w-full max-w-[1500px] space-y-5 pb-6 sm:space-y-6">
      <header className="relative overflow-hidden py-1 sm:py-2">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 size-64 rounded-full bg-blue-100/45 sm:-right-2 sm:-top-40 sm:size-80" />
        <p className="relative text-[11px] font-semibold uppercase tracking-wide text-blue-600 sm:text-xs">Good morning, Alex · September 18</p>
        <h1 id="overview-title" className="relative mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{workspaceGoal.title}</h1>
        <p className="relative mt-1 text-sm text-slate-500 sm:text-base">
          Target: Within {workspaceGoal.timeRemaining.split(' ')[0]} months · You’re making solid progress — keep it up.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>

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
