import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getSavedProfileId } from '../../resume/api'
import { useCurrentRoadmap } from '../../roadmap/useCurrentRoadmap'
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
import type { RoadmapNode, RoadmapView } from '../../roadmap/api-types'

function formatHours(value: { min: number; max: number } | null): string {
  if (!value) return 'Not set'
  const amount = value.min === value.max ? `${value.min}` : `${value.min}–${value.max}`
  return `${amount} hrs/week`
}

function formatEffort(value: RoadmapNode['estimatedHours']): string {
  if (!value) return 'See roadmap details'
  return value.min === value.max ? `${value.min} hours` : `${value.min}–${value.max} hours`
}

function MetricCard({ metric }: { metric: {
  label: string
  value: string
  icon: typeof Target
  tone: 'blue' | 'green' | 'amber' | 'purple'
  progress?: number
} }) {
  const Icon = metric.icon
  const color = {
    blue: 'text-blue-600', green: 'text-emerald-600', amber: 'text-amber-500', purple: 'text-violet-500',
  }[metric.tone]

  return (
    <article className="flex min-h-[104px] flex-col rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm sm:min-h-[116px] sm:py-4">
      <Icon className={`size-5 ${color}`} aria-hidden="true" />
      <p className={`mt-2 text-2xl font-bold leading-none tracking-tight ${color}`}>{metric.value}</p>
      <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
      {metric.progress !== undefined && (
        <div role="progressbar" aria-label="Roadmap progress" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={metric.progress} aria-valuetext={`${metric.progress}% complete`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${metric.progress}%` }} />
        </div>
      )}
    </article>
  )
}

function RoadmapMilestones({ view }: { view: RoadmapView }) {
  const milestones = useMemo(() => {
    const learningNodes = view.nodes
      .filter((node) => node.kind !== 'goal')
      .sort((a, b) => a.order - b.order || a.layer - b.layer)
      .slice(0, 6)
    const goal = view.nodes.find((node) => node.kind === 'goal')
    return goal ? [...learningNodes, goal] : learningNodes
  }, [view.nodes])

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Career Roadmap</h2>
          <p className="mt-1 text-xs text-slate-500">{view.progress.label}</p>
        </div>
        <Link to="/app/roadmap" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-800 sm:text-sm">
          Open full roadmap <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {milestones.length ? (
        <div className="mt-5 overflow-x-auto">
          <ol aria-label="Career roadmap progress" className="flex min-w-[700px] items-start px-2 pb-2 sm:min-w-0 sm:px-0">
            {milestones.map((node, index) => {
              const complete = node.status === 'completed' || node.baselineComplete
              const current = !complete && node.key === view.currentNodeKey
              const goal = node.kind === 'goal'
              return (
                <li key={node.key} className="relative flex flex-1 flex-col items-center text-center">
                  {index > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-5 h-px w-full ${complete || current ? 'bg-blue-300' : 'bg-slate-200'}`} />}
                  <span className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 ${complete ? 'border-blue-500 bg-blue-500 text-white' : current ? 'border-blue-500 bg-blue-600 text-white ring-4 ring-blue-100' : goal ? 'border-amber-500 bg-amber-500 text-white' : 'border-blue-200 bg-slate-50 text-blue-300'}`}>
                    {complete ? <Check className="size-4" aria-hidden="true" /> : current ? <CircleDot className="size-4" aria-hidden="true" /> : goal ? <Star className="size-4" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={`mt-2 max-w-28 text-xs ${current ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
                    {node.title}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : <p className="mt-4 text-sm text-slate-500">No roadmap steps are available yet.</p>}
    </article>
  )
}

function OverviewContent({ view }: { view: RoadmapView }) {
  const skills = view.nodes.filter((node) => node.skill !== null)
  const completedSkills = skills.filter((node) => node.status === 'completed' || node.baselineComplete).length
  const nextNode = view.nodes.find((node) => node.key === view.nextAction.nodeKey)
  const metrics = [
    { label: 'Roadmap Progress', value: `${view.progress.percent}%`, icon: Target, tone: 'blue' as const, progress: view.progress.percent },
    { label: 'Skills Completed', value: `${completedSkills} / ${skills.length}`, icon: CircleCheck, tone: 'green' as const },
    { label: 'Skills to Build', value: String(Math.max(0, skills.length - completedSkills)), icon: Layers3, tone: 'amber' as const },
    { label: 'Weekly Hours', value: formatHours(view.summary.weeklyHours), icon: Clock3, tone: 'purple' as const },
  ]

  return (
    <>
      <header className="relative overflow-hidden py-1 sm:py-2">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 size-64 rounded-full bg-blue-100/45 sm:-right-2 sm:-top-40 sm:size-80" />
        <p className="relative text-[11px] font-semibold uppercase tracking-wide text-blue-600 sm:text-xs">
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        </p>
        <h1 id="overview-title" className="relative mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{view.summary.targetRole}</h1>
        <p className="relative mt-1 text-sm text-slate-500 sm:text-base">
          Target: {view.summary.timeRemainingLabel} · {view.progress.label}
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
          <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">{view.nextAction.text}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-500 sm:leading-6">
            {nextNode?.summary ?? 'Continue with the next step in your saved career roadmap.'}
          </p>
          <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 sm:grid-cols-3 sm:border-0 sm:pt-0">
            <div className="border-blue-100 sm:border-r sm:pr-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-slate-600 sm:text-sm">
                {(nextNode?.whyItMatters.length ? nextNode.whyItMatters.slice(0, 2) : ['Build progress toward your saved career goal.'])
                  .map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
            <div className="border-blue-100 sm:border-r sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated effort</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatEffort(nextNode?.estimatedHours ?? null)}</p>
              <p className="text-xs text-slate-500">{formatHours(view.summary.weeklyHours)}</p>
            </div>
            <div className="sm:pl-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First checklist item</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">
                {nextNode?.checklist[0]?.label ?? 'Open the roadmap to review the step details.'}
              </p>
            </div>
          </div>
          <Link to={nextNode ? `/app/roadmap?node=${encodeURIComponent(nextNode.key)}` : '/app/roadmap'}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Start this action <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </article>

      <RoadmapMilestones view={view} />
    </>
  )
}

export function OverviewPage() {
  const { data: view, isLoading, error, refetch } = useCurrentRoadmap()
  const hasProfile = Boolean(getSavedProfileId())

  if (hasProfile && isLoading) return <p role="status" className="p-6 text-sm text-slate-600">Loading your overview...</p>
  if (error) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">Could not load your overview</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{error.message}</p>
      <button type="button" onClick={() => void refetch()}
        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
    </section>
  )
  if (!view) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-blue-100 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Your Overview</h1>
      <p className="mt-3 text-sm text-slate-600">
        {hasProfile ? 'Your saved roadmap is not available yet. Create a roadmap to see your progress here.'
          : 'Save your profile and career goal to see your personalized overview.'}
      </p>
      <Link to={hasProfile ? '/app/roadmap' : '/onboarding'}
        className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">
        {hasProfile ? 'Open roadmap' : 'Start onboarding'}
      </Link>
    </section>
  )

  return (
    <section aria-labelledby="overview-title" className="mx-auto w-full max-w-[1500px] space-y-5 pb-6 sm:space-y-6">
      <OverviewContent view={view} />
    </section>
  )
}
