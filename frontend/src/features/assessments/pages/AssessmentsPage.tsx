import { workspaceStyles } from '../../workspace/workspaceStyles'
import { learningStatusIcons } from '../../../components/statusIcons'
import { StatusIcon } from '../../../components/StatusIcon'
import { AlertCircle, BadgeCheck, ChevronRight, CircleDashed, ClipboardCheck, FileText, History, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SkillIcon } from '../../../components/SkillIcon'
import { WorkspacePageHeader } from '../../workspace/components/WorkspacePageHeader'
import { Link, useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { applyStepCheck } from '../../roadmap/progress'
import { updateRoadmapSnapshot, useRoadmapSnapshot } from '../../roadmap/roadmapStore'
import type { RoadmapNodeData, RoadmapNodeStatus } from '../../roadmap/type'
import { LevelCheckDialog } from '../components/LevelCheckDialog'
import { StepCheckDialog } from '../components/StepCheckDialog'
import { capitalize } from '../levels'
import { nodeSkillId, stepCheckTasks } from '../roadmapLink'
import { recordStepCheckActivity } from '../stepCheckActivity'
import type { ActivityEntry, LevelCheckTarget, StepCheckSummary } from '../types'
import { useAssessmentsOverview } from '../useAssessments'

const KIND_LABEL: Record<ActivityEntry['kind'], string> = {
  step_check: 'Step check',
  level_check: 'Level check',
  quick_question: 'Quick question',
}
const KIND_STYLE: Record<ActivityEntry['kind'], string> = {
  step_check: 'bg-blue-50 text-blue-700',
  level_check: 'bg-emerald-50 text-emerald-700',
  quick_question: 'bg-slate-100 text-slate-600',
}

// Every state shares one geometry (same border, marker and badge size); only colour and icon change.
const STEP_STATE: Record<RoadmapNodeStatus, { label: string; row: string; bar: string; marker: string; badge: string; title: string }> = {
  completed: {
    label: 'Completed',
    row: 'border-emerald-200 bg-emerald-50/50',
    bar: 'bg-emerald-500',
    marker: 'bg-emerald-500 text-white',
    badge: 'bg-emerald-100 text-emerald-800',
    title: 'text-slate-900',
  },
  'in-progress': {
    label: 'In progress',
    row: 'border-blue-300 bg-white shadow-sm',
    bar: 'bg-blue-600',
    marker: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-800',
    title: 'text-slate-900',
  },
  upcoming: {
    label: 'Upcoming',
    row: 'border-slate-200 bg-slate-50',
    bar: 'bg-slate-300',
    marker: 'bg-slate-200 text-slate-600',
    badge: 'bg-slate-200 text-slate-700',
    title: 'text-slate-600',
  },
}
type StepFilter = 'all' | RoadmapNodeStatus
const STEP_FILTERS: StepFilter[] = ['all', 'completed', 'in-progress', 'upcoming']
const BADGE = 'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold'
const ACTION = 'inline-flex h-7 w-24 shrink-0 items-center justify-center rounded-md text-xs font-semibold'
const STATE_ICON = learningStatusIcons

function stepStatus(node: RoadmapNodeData, summary: StepCheckSummary | undefined, hasCheck: boolean) {
  if (!hasCheck) {
    return node.kind === 'project' ? { text: 'Evidence only', icon: FileText, style: 'text-slate-500' }
      : { text: 'No check yet', icon: CircleDashed, style: 'text-slate-500' }
  }
  const tasks = stepCheckTasks(node).length
  if (!summary) return { text: `Check · ${tasks} task${tasks === 1 ? '' : 's'}`, icon: ClipboardCheck, style: 'text-blue-700' }
  if (summary.reviewTaskIds.length) return { text: `${summary.verified} verified · ${summary.reviewTaskIds.length} to review`, icon: AlertCircle, style: 'text-amber-700' }
  return { text: `${summary.taskCount} of ${summary.taskCount} verified`, icon: BadgeCheck, style: 'text-emerald-700' }
}

export function AssessmentsPage() {
  const navigate = useNavigate()
  const snapshot = useRoadmapSnapshot()
  const { data, error, isLoading, hasProfile, refetch } = useAssessmentsOverview()
  const [stepNode, setStepNode] = useState<RoadmapNodeData | null>(null)
  const [levelTarget, setLevelTarget] = useState<LevelCheckTarget | null>(null)
  const [stepFilter, setStepFilter] = useState<StepFilter>('all')
  const [activityOpen, setActivityOpen] = useState(false)
  const steps = useMemo(() => snapshot.progress.nodes.filter((node) => node.kind !== 'goal')
    .sort((a, b) => a.position.row - b.position.row || a.position.column - b.position.column), [snapshot])
  const stepTasks = useMemo(() => (stepNode ? stepCheckTasks(stepNode) : []), [stepNode])

  function openStep(nodeId: string) {
    navigate(`/app/roadmap?node=${encodeURIComponent(nodeId)}`)
  }

  return (
    <section aria-label="Assessments" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4">
      <WorkspacePageHeader
        title="Assessments"
        description="Check your roadmap learning and skill levels."
        actions={data && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-blue-100 bg-white px-3 py-1.5"><b className="text-slate-900 tabular-nums">{data.stats.verifiedTasks}</b> tasks verified</span>
            <span className="rounded-full border border-blue-100 bg-white px-3 py-1.5"><b className="text-slate-900 tabular-nums">{data.stats.skillsWithLevel} of {data.stats.profileSkills}</b> skills with a level</span>
            <button type="button" onClick={() => setActivityOpen(true)} aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">
              <History size={13} aria-hidden="true" /> Activity
              <span className="rounded-full bg-blue-100 px-1.5 text-xs tabular-nums">{data.activity.length}</span>
            </button>
          </div>
        )}
      />

      {!hasProfile && (
        <div className="rounded-xl border border-blue-100 bg-white p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Save your CV profile first</p>
          <p className="mt-1">Skill checks use your saved profile. Upload and confirm your CV to start.</p>
          <Link to="/onboarding" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Go to onboarding</Link>
        </div>
      )}
      {hasProfile && error && (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          <p>{(error as Error).message}</p>
          <button type="button" onClick={() => void refetch()} className="mt-2 font-semibold underline">Try again</button>
        </div>
      )}
      {hasProfile && isLoading && <p className="text-sm text-slate-500">Loading your skill checks…</p>}

      {data && (
        <>
          <section aria-labelledby="step-checks" className="space-y-2.5">
            <h2 id="step-checks" className={workspaceStyles.sectionTitle}>Roadmap steps</h2>
            <nav aria-label="Filter steps by status" role="tablist" className="flex shrink-0 gap-2 overflow-x-auto border-b border-blue-100">
              {STEP_FILTERS.map((filter) => {
                const Icon = filter === 'all' ? ListChecks : STATE_ICON[filter]
                const count = filter === 'all' ? steps.length : steps.filter((node) => node.status === filter).length
                const active = stepFilter === filter
                return (
                  <button key={filter} type="button" role="tab" id={`step-tab-${filter}`} aria-selected={active} aria-controls="step-tabpanel"
                    onClick={() => setStepFilter(filter)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition ${active ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    <Icon size={15} aria-hidden="true" />
                    {filter === 'all' ? 'All steps' : STEP_STATE[filter].label}
                    <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                )
              })}
            </nav>
            <ol id="step-tabpanel" role="tabpanel" aria-labelledby={`step-tab-${stepFilter}`} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((node, index) => {
                if (stepFilter !== 'all' && node.status !== stepFilter) return null
                const hasCheck = stepCheckTasks(node).length > 0
                const status = stepStatus(node, data.stepChecks.find((item) => item.stepKey === node.id), hasCheck)
                const state = STEP_STATE[node.status]
                const Icon = STATE_ICON[node.status]
                return (
                  <li key={node.id} aria-current={node.status === 'in-progress' ? 'step' : undefined}
                    className={`relative flex flex-col gap-3 overflow-hidden rounded-xl border py-3 pl-4 pr-3 ${state.row}`}>
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${state.bar}`} />
                    <div className="flex items-start gap-2.5">
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${state.marker}`}>
                        {node.status === 'completed' ? <StatusIcon status="completed" size={14} /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => openStep(node.id)} title="Open this step in your roadmap"
                          className={`group inline-flex max-w-full items-center gap-0.5 text-left text-sm font-semibold hover:text-blue-700 ${state.title}`}>
                          <span className="truncate group-hover:underline">{node.title}</span>
                          <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-blue-700" />
                        </button>
                        <p className="text-xs text-slate-500">Step {index + 1} · {node.kind === 'project' ? 'Project' : 'Skill'}</p>
                      </div>
                      <span className={`${BADGE} ${state.badge}`}><Icon size={11} aria-hidden="true" /> {state.label}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-900/5 pt-2.5">
                      <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-medium ${status.style}`}>
                        <status.icon size={14} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">{status.text}</span>
                      </span>
                      {hasCheck && node.status === 'in-progress' ? (
                        <button type="button" onClick={() => setStepNode(node)} className={`${ACTION} bg-blue-600 text-white hover:bg-blue-700`}>Take check</button>
                      ) : (
                        <button type="button" onClick={() => openStep(node.id)} className={`${ACTION} border border-blue-200 bg-white text-blue-700 hover:bg-blue-50`}>Open step</button>
                      )}
                    </div>
                  </li>
                )
              })}
              {stepFilter !== 'all' && !steps.some((node) => node.status === stepFilter) && (
                <li className="rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">No {STEP_STATE[stepFilter].label.toLowerCase()} steps.</li>
              )}
            </ol>
          </section>

          <section aria-labelledby="level-checks" className="space-y-2.5">
            <h2 id="level-checks" className={workspaceStyles.sectionTitle}>Level checks</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.levelChecks.map((target) => (
                <article key={target.skillId} className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white p-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SkillIcon name={target.name} skillId={target.skillId} size={18} />{target.name}</h3>
                    <p className="text-xs text-slate-500">{target.level ? `${capitalize(target.level)} · ${target.reason}` : target.reason}</p>
                  </div>
                  <span className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${target.hasQuiz ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>
                    {target.hasQuiz ? 'Quiz · about 5 min' : 'Self-check · about 1 min'}
                  </span>
                  <button type="button" onClick={() => setLevelTarget(target)} className="mt-auto min-h-8 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
                    {target.level ? 'Re-check level' : 'Start level check'}
                  </button>
                </article>
              ))}
            </div>
          </section>

        </>
      )}

      {activityOpen && data && (
        <Dialog open onOpenChange={(open) => { if (!open) setActivityOpen(false) }}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-xl sm:max-w-xl">
            <DialogTitle className="pr-8 text-lg font-semibold">Activity</DialogTitle>
            <DialogDescription>Newest first.</DialogDescription>
            {data.activity.length === 0 ? (
              <p className="rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-500">No checks yet. Start with a step in your roadmap.</p>
            ) : (
              <ul className="divide-y divide-blue-50 overflow-hidden rounded-xl border border-blue-100 bg-white">
                {data.activity.map((entry) => {
                  const step = entry.stepKey ? snapshot.progress.nodes.find((node) => node.id === entry.stepKey) : undefined
                  return (
                    <li key={entry.assessmentId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-xs">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${KIND_STYLE[entry.kind]}`}>{KIND_LABEL[entry.kind]}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{entry.kind === 'step_check' ? step?.title ?? entry.stepKey : entry.skillName}</p>
                        <p className="text-slate-600">{entry.text}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-500">
                        {entry.decision === 'accepted' ? (entry.kind === 'step_check' ? 'Applied' : 'Kept') : entry.decision === 'declined' ? 'Not kept' : 'Pending'}
                        {entry.at ? ` · ${new Date(entry.at).toLocaleDateString()}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      )}
      {stepNode && (
        <StepCheckDialog onClose={() => setStepNode(null)} stepKey={stepNode.id} stepTitle={stepNode.title}
          skillId={nodeSkillId(stepNode)} tasks={stepTasks} entryPoint="assessments"
          onApplied={(verified, review) => {
            updateRoadmapSnapshot((current) => ({
              ...current, progress: { ...current.progress, nodes: applyStepCheck(current.progress.nodes, stepNode.id, verified, review) },
            }))
            recordStepCheckActivity(stepNode, verified.length, review.length)
          }} />
      )}
      {levelTarget && (
        <LevelCheckDialog onClose={() => setLevelTarget(null)} skillId={levelTarget.skillId} skillName={levelTarget.name} entryPoint="assessments" />
      )}
    </section>
  )
}
