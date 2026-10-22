import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import type { RoadmapNodeData } from '../../roadmap/type'
import { assessmentsApi, overviewKey } from '../api'
import { levelLabel, QUICK_ANSWERS } from '../levels'
import { nodeSkillId, stepCheckTasks } from '../roadmapLink'
import { useAssessmentsOverview } from '../useAssessments'
import { LevelCheckDialog } from './LevelCheckDialog'
import { StepCheckDialog } from './StepCheckDialog'

/** Replaces the static "Not assessed" line in the step panel with the profile level, when known. */
export function SkillLevelLine({ node }: { node: RoadmapNodeData }) {
  const skillId = nodeSkillId(node)
  const { data } = useAssessmentsOverview()
  const target = data?.levelChecks.find((item) => item.skillId === skillId)
  return <p className="mt-0.5 text-[11px] text-blue-700">{levelLabel(target)}</p>
}

type StepCheckSectionProps = {
  node: RoadmapNodeData
  onApplied: (verifiedTaskIds: string[], reviewTaskIds: string[]) => void
}

/** Step check, quick question and level check for one roadmap step. */
export function StepCheckSection({ node, onApplied }: StepCheckSectionProps) {
  const queryClient = useQueryClient()
  const tasks = useMemo(() => stepCheckTasks(node), [node])
  const skillId = nodeSkillId(node)
  const { data, hasProfile } = useAssessmentsOverview()
  const [dialog, setDialog] = useState<'step' | 'level' | null>(null)
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState('')

  if (!tasks.length && !skillId) return null
  const target = data?.levelChecks.find((item) => item.skillId === skillId)
  const summary = data?.stepChecks.find((item) => item.stepKey === node.id)
  const items = node.checklist ?? []
  const byId = (id: string) => items.find((item) => item.id === id)
  const anyStudied = tasks.some((task) => byId(task.taskId)?.completed)
  const allVerified = tasks.length > 0 && tasks.every((task) => byId(task.taskId)?.verified)
  const inProgress = node.status === 'in-progress'
  const skillName = target?.name ?? node.title

  async function quick(answer: (typeof QUICK_ANSWERS)[number]) {
    if (!skillId) return
    setQuickBusy(true)
    setQuickError('')
    try {
      await assessmentsApi.quick({ skillId, level: answer.level, answer: answer.label, entryPoint: 'roadmap', stepKey: node.id })
      await queryClient.invalidateQueries({ queryKey: overviewKey() })
    } catch (error) {
      setQuickError((error as Error).message)
    } finally {
      setQuickBusy(false)
    }
  }

  return (
    <section aria-label="Skill checks" className="space-y-2 rounded-lg border border-blue-100 bg-white p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
        <ClipboardCheck size={15} className="text-blue-600" aria-hidden="true" />
        Skill checks
      </h3>
      {!hasProfile && <p className="text-[11px] text-slate-500">Save your CV profile to use skill checks.</p>}

      {hasProfile && tasks.length > 0 && (
        <>
          {inProgress && !anyStudied && !summary && (
            <div className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-slate-700">
              <p className="text-xs font-semibold text-slate-900">Know some of this already?</p>
              <p>Take the step check first. Study tasks you answer correctly are ticked for you, so you can skip them.</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[11px]">
              <p className="font-semibold text-slate-800">Step check</p>
              <p className="text-slate-500">
                {summary
                  ? `${summary.verified} of ${summary.taskCount} study tasks verified${summary.reviewTaskIds.length ? ` · ${summary.reviewTaskIds.length} to review` : ''}`
                  : `Questions on ${tasks.length} study task${tasks.length === 1 ? '' : 's'} · a few minutes`}
              </p>
            </div>
            <button type="button" disabled={!inProgress} onClick={() => setDialog('step')}
              title={inProgress ? 'Answer questions about this step’s study tasks' : 'Start this step to take its check'}
              className={`min-h-8 shrink-0 rounded-lg px-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${summary ? 'border border-blue-200 text-blue-700 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {summary ? 'Retake' : 'Take step check'}
            </button>
          </div>
          {!inProgress && node.status === 'upcoming' && <p className="text-[10px] text-slate-500">Start this step to take its check.</p>}
        </>
      )}

      {hasProfile && skillId && allVerified && !target?.level && (
        <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800">
          <p className="text-xs font-semibold">All study tasks verified</p>
          <p>Confirm your {skillName} level with a 5-minute level check.</p>
          <button type="button" onClick={() => setDialog('level')} className="min-h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-semibold text-white hover:bg-blue-700">Take the level check</button>
        </div>
      )}

      {hasProfile && skillId && target && !target.level && !tasks.length && (
        <div className="space-y-1.5 text-[11px]">
          <p className="font-semibold text-slate-800">Quick question</p>
          <p className="text-slate-600">How comfortable are you with {skillName}?</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ANSWERS.map((answer) => (
              <button key={answer.level} type="button" disabled={quickBusy} onClick={() => void quick(answer)}
                className="min-h-8 rounded-lg border border-blue-200 px-2.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                {answer.label}
              </button>
            ))}
          </div>
          {quickError && <p role="alert" className="text-red-700">{quickError}</p>}
        </div>
      )}

      {hasProfile && skillId && (
        <button type="button" onClick={() => setDialog('level')} className="text-[11px] font-semibold text-blue-700 underline underline-offset-2">
          {target?.level ? `Re-check your ${skillName} level` : `Take the full ${skillName} level check`}
        </button>
      )}

      {dialog === 'step' && (
        <StepCheckDialog onClose={() => setDialog(null)} stepKey={node.id} stepTitle={node.title} skillId={skillId}
          tasks={tasks} entryPoint="roadmap" onApplied={onApplied} />
      )}
      {dialog === 'level' && skillId && (
        <LevelCheckDialog onClose={() => setDialog(null)} skillId={skillId} skillName={skillName} entryPoint="roadmap" />
      )}
    </section>
  )
}
