import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { assessmentsApi, overviewKey } from '../api'
import type { EntryPoint, StepCheckResult, StepCheckStart, StepTask } from '../types'
import { AnswerReviewItem } from './AnswerReview'
import { QuestionCard } from './QuestionCard'

type StepCheckDialogProps = {
  onClose: () => void
  stepKey: string
  stepTitle: string
  skillId?: number
  tasks: StepTask[]
  entryPoint: EntryPoint
  /** Called after the learner chooses to tick the verified tasks. */
  onApplied: (verifiedTaskIds: string[], reviewTaskIds: string[]) => void
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'question'; check: StepCheckStart; index: number; answers: Array<{ itemId: number; choice: number }> }
  | { kind: 'submitting' }
  | { kind: 'result'; result: StepCheckResult }

/** A study task without questions gets new ones written from its source, which can take a few seconds. */
function PreparingQuestions() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 2500)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div role="status" className="flex items-start gap-2 text-sm text-slate-500">
      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      <p>{slow ? 'Writing questions from this step’s sources. This can take up to 20 seconds.' : 'Preparing your questions…'}</p>
    </div>
  )
}

/** Mount only while open; each mount starts one step check. */
export function StepCheckDialog({ onClose, stepKey, stepTitle, skillId, tasks, entryPoint, onApplied }: StepCheckDialogProps) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    assessmentsApi.startStepCheck({ stepKey, skillId, tasks, entryPoint })
      .then((check) => { if (!cancelled) setPhase({ kind: 'question', check, index: 0, answers: [] }) })
      .catch((error: Error) => { if (!cancelled) setPhase({ kind: 'error', message: error.message }) })
    return () => { cancelled = true }
  }, [stepKey, skillId, tasks, entryPoint])

  async function answer(choice: number) {
    if (phase.kind !== 'question') return
    const { check, index } = phase
    const answers = [...phase.answers, { itemId: check.questions[index].itemId, choice }]
    if (index + 1 < check.questions.length) {
      setPhase({ kind: 'question', check, index: index + 1, answers })
      return
    }
    setPhase({ kind: 'submitting' })
    try {
      setPhase({ kind: 'result', result: await assessmentsApi.finishStepCheck(check.assessmentId, answers) })
      void queryClient.invalidateQueries({ queryKey: overviewKey() })
    } catch (error) {
      setPhase({ kind: 'error', message: (error as Error).message })
    }
  }

  async function finish(apply: boolean) {
    if (phase.kind !== 'result') return
    setApplying(true)
    try {
      const applied = await assessmentsApi.applyStepCheck(phase.result.assessmentId, apply)
      if (apply) onApplied(applied.verifiedTaskIds, applied.reviewTaskIds)
      void queryClient.invalidateQueries({ queryKey: overviewKey() })
      onClose()
    } catch (error) {
      setPhase({ kind: 'error', message: (error as Error).message })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogTitle className="pr-8 text-lg font-semibold">{stepTitle} · step check</DialogTitle>
        <DialogDescription>Questions come from the sources of this step’s study tasks.</DialogDescription>

        {phase.kind === 'loading' && <PreparingQuestions />}
        {phase.kind === 'submitting' && <p className="text-sm text-slate-500">Checking your answers…</p>}
        {phase.kind === 'error' && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{phase.message}</p>}

        {phase.kind === 'question' && (() => {
          const question = phase.check.questions[phase.index]
          return (
            <QuestionCard
              key={question.itemId}
              question={question}
              label={`Question ${phase.index + 1} of ${phase.check.questions.length} · about the task “${(question.taskLabel ?? '').replace(/^Study: /, '')}”`}
              progress={phase.index / phase.check.questions.length}
              submitLabel={phase.index + 1 < phase.check.questions.length ? 'Next' : 'See results'}
              onAnswer={(choice) => void answer(choice)}
            />
          )
        })()}

        {phase.kind === 'result' && (
          <div className="space-y-3">
            <p className="text-base font-semibold text-slate-900">
              {phase.result.verifiedCount} of {phase.result.taskCount} study tasks verified
            </p>
            <ul className="space-y-2">
              {phase.result.tasks.map((task) => (
                <li key={task.taskId} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{task.label.replace(/^Study: /, '')}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {task.verified ? 'Verified' : 'Review this task'}
                    </span>
                  </div>
                  {task.questions.map((review) => <AnswerReviewItem key={review.itemId} review={review} />)}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">This checks knowledge from the step’s sources. It does not test hands-on work. Practice tasks stay yours to tick.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={applying} onClick={() => void finish(true)}
                className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">
                {phase.result.verifiedCount
                  ? `Tick ${phase.result.verifiedCount} verified task${phase.result.verifiedCount === 1 ? '' : 's'}`
                  : 'Mark tasks to review'}
              </button>
              <button type="button" disabled={applying} onClick={() => void finish(false)}
                className="min-h-9 rounded-lg border border-blue-200 px-4 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                Not now
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
