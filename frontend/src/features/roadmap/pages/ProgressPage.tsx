import { workspaceStyles } from '../../workspace/workspaceStyles'
import { learningStatusIcons } from '../../../components/statusIcons'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { ArrowRight, ClipboardList, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WorkspacePageHeader } from '../../workspace/components/WorkspacePageHeader'
import { RoadmapNodeIcon } from '../components/RoadmapNodeIcon'
import { UpdateReplanCard } from '../components/UpdateReplanCard'
import { RecentActivity } from '../components/RecentActivity'
import { useProgressOverview } from '../progressOverview'
import { useCurrentRoadmap } from '../useCurrentRoadmap'
import { toRoadmapScreen } from '../adapter'
import type { RoadmapNodeKind } from '../type'

const categories: { kind: RoadmapNodeKind; label: string; color: string }[] = [
  { kind: 'skill', label: 'Skills', color: 'bg-blue-600' },
  { kind: 'project', label: 'Projects', color: 'bg-violet-600' },
  { kind: 'career-activity', label: 'Career activities', color: 'bg-emerald-600' },
  { kind: 'goal', label: 'Career goal', color: 'bg-slate-600' },
]

const roadmapLink = (nodeId: string) => `/app/roadmap?node=${encodeURIComponent(nodeId)}`

export function ProgressPage() {
  const roadmap = useCurrentRoadmap()
  const overview = useProgressOverview()
  if (roadmap.isPending) return <p role="status" className={workspaceStyles.loading}>Loading your progress…</p>
  if (roadmap.isError) return <section className={workspaceStyles.statePanel}><h1 className={workspaceStyles.pageTitle}>Could not load your progress</h1><p role="alert" className="mt-3 text-sm leading-6 text-destructive">{roadmap.error.message}</p><button type="button" onClick={() => void roadmap.refetch()} className={`mt-5 ${workspaceStyles.primaryAction}`}>Try again</button></section>
  if (!roadmap.data) return <section className={workspaceStyles.statePanel}><h1 className={workspaceStyles.pageTitle}>Progress</h1><p className={workspaceStyles.stateDescription}>Create your roadmap to start tracking progress.</p><Link to="/app/roadmap" className={`mt-5 ${workspaceStyles.primaryAction}`}>Open My Roadmap</Link></section>
  const view = roadmap.data
  const screen = toRoadmapScreen(view)
  const { nodes } = screen
  const completionPercent = screen.summary.completion
  const statusById = new Map(view.nodes.map((node) => [node.key, node.status]))
  const completed = nodes.filter((node) => node.status === 'completed').length
  const inProgress = nodes.filter((node) => node.status === 'in-progress').length
  const upcoming = nodes.filter((node) => statusById.get(node.id) === 'not_started').length
  const skipped = view.nodes.filter((node) => node.status === 'skipped').length
  const checklistItems = nodes.flatMap((node) => node.checklist ?? [])
  const checkedItems = checklistItems.filter((item) => item.completed).length
  const currentStep = nodes.find((node) => node.id === view.currentNodeKey && node.status === 'in-progress')
    ?? nodes.find((node) => node.status === 'in-progress')
  const focusStep = currentStep ?? nodes.find((node) => node.id === view.nextAction.nodeKey && statusById.get(node.id) === 'not_started')
  const focusChecklist = focusStep?.checklist ?? []
  const focusChecked = focusChecklist.filter((item) => item.completed).length
  const nextSteps = nodes.filter((node) => statusById.get(node.id) === 'not_started' && node.id !== focusStep?.id).slice(0, 4)

  return (
    <section aria-label="Progress" className="@container/progress mx-auto flex w-full min-w-0 max-w-[1500px] flex-col gap-4 pb-4 sm:gap-5">
      <WorkspacePageHeader
        title="Progress"
        description="Your saved roadmap progress, current learning step, and upcoming work."
      />

      {overview.isPending && <p role="status" className="text-sm text-slate-600">Loading profile summary and activity…</p>}
      {overview.isError && <p role="alert" className="text-sm text-red-700">Could not load profile summary and activity: {overview.error.message} <button type="button" onClick={() => void overview.refetch()} className="underline">Try again</button></p>}

      <StatGrid label="Roadmap progress statistics" mobileColumns={2}>
        <StatCard compactOnMobile label="Roadmap completion" value={`${completionPercent}%`} icon={Target}
          detail={screen.summary.statusText} progress={completionPercent} />
        <StatCard compactOnMobile label="Completed" value={completed} icon={learningStatusIcons.completed} tone="success"
          detail="Skills, projects, and career steps" />
        <StatCard compactOnMobile label="In progress" value={inProgress} icon={learningStatusIcons['in-progress']}
          detail={`${upcoming} upcoming · ${skipped} skipped`} />
        <StatCard compactOnMobile label="Checklist items" value={`${checkedItems} / ${checklistItems.length}`} icon={ClipboardList} tone="info"
          detail="Checked across your roadmap" />
      </StatGrid>

      <div className="grid min-w-0 items-start gap-3 @min-[52rem]/progress:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className={workspaceStyles.sectionTitle}>{currentStep ? 'Your current step' : focusStep ? 'Your next step' : completionPercent === 100 ? 'Roadmap complete' : 'Review your roadmap'}</h2>
          {focusStep ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><RoadmapNodeIcon node={focusStep} size={21} /></span>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{focusStep.title}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{focusStep.description}</p>
                </div>
              </div>
              {focusChecklist.length > 0 && <p className="mt-3 text-xs text-slate-600">{focusChecked} of {focusChecklist.length} checklist items checked</p>}
              <Link to={roadmapLink(focusStep.id)} className={`mt-4 w-full sm:w-auto ${workspaceStyles.primaryAction}`}>Open this step <ArrowRight size={14} aria-hidden="true" /></Link>
            </>
          ) : (
            <p className={workspaceStyles.stateDescription}>{completionPercent === 100 ? 'Every task on your roadmap is complete.' : view.nextAction.text}</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className={workspaceStyles.sectionTitle}>Coming up</h2>
          {nextSteps.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {nextSteps.map((node) => (
                <li key={node.id}>
                  <Link to={roadmapLink(node.id)} className="flex min-h-11 items-center gap-3 py-3 text-sm font-medium text-slate-700 hover:text-blue-700 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600"><RoadmapNodeIcon node={node} size={15} /></span>
                    <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{node.title}</span>
                    <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">No upcoming steps remain.</p>}
        </section>
      </div>

      {overview.data && <UpdateReplanCard overview={overview.data} completedProjects={nodes.filter((node) => node.kind === 'project' && node.status === 'completed').length} />}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={workspaceStyles.sectionTitle}>Progress by type</h2>
          <Link to="/app/skill-profile" className="inline-flex min-h-11 w-full items-center justify-between gap-2 text-sm font-semibold text-primary hover:underline focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-primary sm:min-h-0 sm:w-auto sm:justify-start">View Skill Profile <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-4 @min-[36rem]/progress:grid-cols-2">
          {categories.map(({ kind, label, color }) => {
            const group = nodes.filter((node) => node.kind === kind)
            const done = group.filter((node) => node.status === 'completed').length
            const percent = group.length ? Math.round((done / group.length) * 100) : 0
            return (
              <div key={kind}>
                <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-800">{label}</span><span className="text-slate-500">{done} / {group.length}</span></div>
                <div role="progressbar" aria-label={`${label} completed`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-[width] ${color}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>
      {overview.data && <RecentActivity activities={overview.data.activities} roadmapId={view.roadmapId} />}
    </section>
  )
}
