import { learningStatusIcons } from '../../../components/statusIcons'
import { StatusIcon } from '../../../components/StatusIcon'
import { StatCard, StatGrid } from '../components/StatCard'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSavedProfileId, loadSavedCareerMatch } from '../../resume/api'
import type { CareerMatchResult, SavedCareerGoal } from '../../resume/api'
import { useCurrentRoadmap } from '../../roadmap/useCurrentRoadmap'
import { toRoadmapScreen } from '../../roadmap/adapter'
import type { RoadmapNode, RoadmapView } from '../../roadmap/api-types'
import {
  ArrowRight,
  CircleCheck,
  Clock3,
  Layers3,
  Star,
  Target,
  Zap,
} from 'lucide-react'

const careerMatchMetrics = [
  { key: 'coreSkillMatchPct', label: 'Core Top 20 coverage', detail: 'Weighted top skills · cutoff ties included', icon: Target, tone: 'blue' },
  { key: 'marketSkillCoveragePct', label: 'All career skills coverage', detail: 'All usable market skills', icon: CircleCheck, tone: 'green' },
  { key: 'proficiencyAlignmentPct', label: 'Proficiency alignment', detail: 'Weighted level match where assessed', icon: Layers3, tone: 'amber' },
  { key: 'assessmentCoveragePct', label: 'Assessment coverage', detail: 'Share of market weight assessed', icon: Clock3, tone: 'purple' },
] as const

type CareerMatch = { goal: SavedCareerGoal; match: CareerMatchResult }

function formatHours(value: { min: number; max: number } | null): string {
  if (!value) return 'Not set'
  const amount = value.min === value.max ? `${value.min}` : `${value.min}–${value.max}`
  return `${amount} hrs/week`
}

function formatEffort(value: RoadmapNode['estimatedHours']): string {
  if (!value) return 'See roadmap details'
  return value.min === value.max ? `${value.min} hours` : `${value.min}–${value.max} hours`
}

function CareerMatchMetricCard({ metric, value }: {
  metric: (typeof careerMatchMetrics)[number]
  value: number | null
}) {
  const formattedValue = value === null ? '—' : `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`
  const tone = { blue: 'primary', green: 'success', amber: 'warning', purple: 'info' } as const
  return <StatCard label={metric.label} value={formattedValue} icon={metric.icon} tone={tone[metric.tone]}
    detail={metric.detail} progress={value} />
}

function RoadmapMetricCard({ metric }: { metric: {
  label: string
  value: string
  icon: typeof Target
  tone: 'blue' | 'green' | 'amber' | 'purple'
  progress?: number
} }) {
  const tone = { blue: 'primary', green: 'success', amber: 'warning', purple: 'info' } as const
  return <StatCard label={metric.label} value={metric.value} icon={metric.icon} tone={tone[metric.tone]} progress={metric.progress} />
}

function CareerMatchSection({ careerMatch, loading, error }: {
  careerMatch: CareerMatch | null
  loading: boolean
  error: string | null
}) {
  const match = careerMatch?.match
  const scores = match?.scores
  const skillSummary = match?.skillSummary

  return (
    <section aria-labelledby="career-match-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="career-match-title" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Career Match</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Scores use separate market skill sets and describe profile coverage, not job readiness.</p>
        </div>
        {match && <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${match.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {match.status === 'ready' ? 'Market data ready' : 'Estimated · review notes'}
        </span>}
      </div>
      <StatGrid label="Career match statistics">
        {careerMatchMetrics.map((metric) => <CareerMatchMetricCard key={metric.label} metric={metric}
          value={scores?.[metric.key] ?? null} />)}
      </StatGrid>
      {loading && <p role="status" className="text-xs text-slate-500">Loading your career match…</p>}
      {!loading && error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
      {!loading && !error && !careerMatch && <p className="rounded-lg border border-blue-100 bg-white/70 px-4 py-3 text-xs text-slate-600">
        Complete onboarding and choose a target role available in the career catalog to calculate these scores.
      </p>}
      {skillSummary && careerMatch && <div aria-label="Profile skills and availability" className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-blue-100 bg-white/70 px-4 py-2.5 text-xs text-slate-600">
        <span><strong className="font-semibold text-slate-900">{skillSummary.covered} / {skillSummary.considered}</strong> market skills in profile</span>
        <span><strong className="font-semibold text-slate-900">{skillSummary.missingFromProfile}</strong> skills missing</span>
        {careerMatch.goal.availableHoursPerWeek !== null && <span><strong className="font-semibold text-slate-900">{careerMatch.goal.availableHoursPerWeek} hrs</strong> per week</span>}
      </div>}
      {match?.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700">{warning}</p>)}
    </section>
  )
}

function RoadmapMilestones({ view }: { view: RoadmapView }) {
  const progressLabel = toRoadmapScreen(view).summary.statusText
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
          <p className="mt-1 text-xs text-slate-500">{progressLabel}</p>
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
                    {complete ? <StatusIcon status="completed" size={16} /> : current ? <StatusIcon status="in-progress" size={16} /> : goal ? <Star className="size-4" aria-hidden="true" /> : <StatusIcon status="upcoming" size={16} />}
                  </span>
                  <span className={`mt-2 max-w-28 text-xs ${current ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>{node.title}</span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : <p className="mt-4 text-sm text-slate-500">No roadmap steps are available yet.</p>}
    </article>
  )
}

function RoadmapContent({ view }: { view: RoadmapView }) {
  const skills = view.nodes.filter((node) => node.skill !== null)
  const completedSkills = skills.filter((node) => node.status === 'completed' || node.baselineComplete).length
  const nextNode = view.nodes.find((node) => node.key === view.nextAction.nodeKey)
  const progress = toRoadmapScreen(view).summary
  const metrics = [
    { label: 'Roadmap Progress', value: `${progress.completion}%`, icon: Target, tone: 'blue' as const, progress: progress.completion },
    { label: 'Skills Completed', value: `${completedSkills} / ${skills.length}`, icon: learningStatusIcons.completed, tone: 'green' as const },
    { label: 'Skills to Build', value: String(Math.max(0, skills.length - completedSkills)), icon: Layers3, tone: 'amber' as const },
    { label: 'Weekly Hours', value: formatHours(view.summary.weeklyHours), icon: Clock3, tone: 'purple' as const },
  ]

  return (
    <>
      <StatGrid label="Roadmap summary statistics">
        {metrics.map((metric) => <RoadmapMetricCard key={metric.label} metric={metric} />)}
      </StatGrid>
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
  const [careerMatch, setCareerMatch] = useState<CareerMatch | null>(null)
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [matchError, setMatchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadSavedCareerMatch().then((result) => {
      if (active) setCareerMatch(result)
    }).catch((caught: unknown) => {
      if (active) setMatchError(caught instanceof Error ? caught.message : 'Unable to load career match scores.')
    }).finally(() => {
      if (active) setLoadingMatch(false)
    })
    return () => { active = false }
  }, [])

  const targetRole = careerMatch?.goal.targetRoleTitle ?? view?.summary.targetRole ?? 'Career Overview'
  const goalSubtitle = careerMatch
    ? `Target: ${careerMatch.goal.readinessTimeframe.replaceAll('_', ' ')} · Career match scores are based on your confirmed profile.`
    : view ? `Target: ${view.summary.timeRemainingLabel} · ${toRoadmapScreen(view).summary.statusText}`
      : 'Career match scores are based on your confirmed profile and target role.'

  if (hasProfile && isLoading) return <p role="status" className="p-6 text-sm text-slate-600">Loading your overview...</p>
  if (error) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">Could not load your overview</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{error.message}</p>
      <button type="button" onClick={() => void refetch()}
        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
    </section>
  )

  return (
    <section aria-labelledby="overview-title" className="mx-auto w-full max-w-[1500px] space-y-5 pb-6 sm:space-y-6">
      <header className="relative overflow-hidden py-1 sm:py-2">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 size-64 rounded-full bg-blue-100/45 sm:-right-2 sm:-top-40 sm:size-80" />
        <p className="relative text-[11px] font-semibold uppercase tracking-wide text-blue-600 sm:text-xs">
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        </p>
        <h1 id="overview-title" className="relative mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{targetRole}</h1>
        <p className="relative mt-1 text-sm text-slate-500 sm:text-base">{goalSubtitle}</p>
      </header>
      <CareerMatchSection careerMatch={careerMatch} loading={loadingMatch} error={matchError} />
      {view ? <RoadmapContent view={view} /> : (
        <section className="rounded-2xl border border-blue-100 bg-white p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900">Your roadmap is not ready yet</h2>
          <p className="mt-3 text-sm text-slate-600">
            {hasProfile ? 'Create a roadmap to see your learning progress and next action here.'
              : 'Save your profile and career goal to see a personalized overview.'}
          </p>
          <Link to={hasProfile ? '/app/roadmap' : '/onboarding'}
            className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">
            {hasProfile ? 'Open roadmap' : 'Start onboarding'}
          </Link>
        </section>
      )}
    </section>
  )
}
