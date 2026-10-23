import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { assessmentsApi, overviewKey } from '../api'
import { capitalize } from '../levels'
import type { EntryPoint, LevelCheckStart, LevelResult, Question } from '../types'
import { AnswerReviewItem } from './AnswerReview'
import { QuestionCard } from './QuestionCard'

type LevelCheckDialogProps = {
  onClose: () => void
  onDecision?: (kept: boolean) => void
  skillId: number
  skillName: string
  entryPoint: EntryPoint
}

type Answer = 'yes' | 'unsure' | 'no'
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'self'; start: LevelCheckStart }
  | { kind: 'question'; start: LevelCheckStart; question: Question }
  | { kind: 'result'; result: LevelResult }
  | { kind: 'done'; kept: boolean; result: LevelResult }

const SELF_ANSWERS: Array<[Answer, string]> = [['yes', 'Yes'], ['unsure', 'Not sure'], ['no', 'No']]
const CONFIDENCE_STYLE = { high: 'bg-emerald-50 text-emerald-700', medium: 'bg-blue-50 text-blue-700', low: 'bg-amber-50 text-amber-800' }

/** Mount only while open; each mount starts one level check. */
export function LevelCheckDialog({ onClose, onDecision, skillId, skillName, entryPoint }: LevelCheckDialogProps) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [selfAnswers, setSelfAnswers] = useState<Record<string, Answer>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    assessmentsApi.startLevelCheck(skillId, entryPoint)
      .then((start) => { if (!cancelled) setPhase({ kind: 'self', start }) })
      .catch((error: Error) => { if (!cancelled) setPhase({ kind: 'error', message: error.message }) })
    return () => { cancelled = true }
  }, [skillId, entryPoint])

  async function run(step: () => Promise<{ question?: Question; result?: LevelResult }>, start?: LevelCheckStart) {
    setBusy(true)
    try {
      const next = await step()
      if (next.result) {
        setPhase({ kind: 'result', result: next.result })
        void queryClient.invalidateQueries({ queryKey: overviewKey() })
      } else if (next.question && start) setPhase({ kind: 'question', start, question: next.question })
    } catch (error) {
      setPhase({ kind: 'error', message: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function decide(kept: boolean) {
    if (phase.kind !== 'result') return
    setBusy(true)
    try {
      await assessmentsApi.decide(phase.result.assessmentId, kept ? 'accepted' : 'declined')
      setPhase({ kind: 'done', kept, result: phase.result })
      void queryClient.invalidateQueries({ queryKey: overviewKey() })
      onDecision?.(kept)
    } catch (error) {
      setPhase({ kind: 'error', message: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const start = phase.kind === 'self' || phase.kind === 'question' ? phase.start : null
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogTitle className="pr-8 text-lg font-semibold">{skillName} · level check</DialogTitle>
        <DialogDescription>
          {start && !start.hasQuiz ? 'Self-check only. There are no reviewed questions for this skill yet.'
            : 'A short self-check, then up to 9 questions that adapt to your answers.'}
        </DialogDescription>

        {phase.kind === 'loading' && <p className="text-sm text-slate-500">Preparing your check…</p>}
        {phase.kind === 'error' && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{phase.message}</p>}

        {phase.kind === 'self' && (
          <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault()
            void run(() => assessmentsApi.submitSelfCheck(phase.start.assessmentId, selfAnswers), phase.start)
          }}>
            <p className="text-xs text-slate-600">How much of this can you do today?</p>
            {phase.start.statements.map((statement) => (
              <fieldset key={statement.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <legend className="sr-only">{statement.text}</legend>
                <span aria-hidden="true" className="min-w-0 flex-1 text-sm text-slate-800">{statement.text}</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                  {SELF_ANSWERS.map(([value, label]) => (
                    <label key={value} className={`cursor-pointer border-r border-slate-300 px-2.5 py-1 text-xs last:border-r-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${selfAnswers[statement.id] === value ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600'}`}>
                      <input type="radio" className="sr-only" name={`statement-${statement.id}`} value={value}
                        checked={selfAnswers[statement.id] === value}
                        onChange={() => setSelfAnswers((current) => ({ ...current, [statement.id]: value }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="flex justify-end">
              <button type="submit" disabled={busy || Object.keys(selfAnswers).length < phase.start.statements.length}
                className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">
                {phase.start.hasQuiz ? 'Continue to questions' : 'See my result'}
              </button>
            </div>
          </form>
        )}

        {phase.kind === 'question' && (
          <QuestionCard
            key={phase.question.itemId}
            question={phase.question}
            label={`Question ${phase.question.number} of up to ${phase.question.maxQuestions}`}
            progress={((phase.question.number ?? 1) - 1) / (phase.question.maxQuestions ?? 9)}
            submitLabel="Next"
            busy={busy}
            onAnswer={(choice) => void run(() => assessmentsApi.answer(phase.start.assessmentId, phase.question.itemId, choice), phase.start)}
          />
        )}

        {(phase.kind === 'result' || phase.kind === 'done') && (
          <LevelResultView result={phase.result} />
        )}
        {phase.kind === 'result' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void decide(true)}
              className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">Use this result</button>
            <button type="button" disabled={busy} onClick={() => void decide(false)}
              className="min-h-9 rounded-lg border border-blue-200 px-4 text-xs font-semibold text-blue-700 hover:bg-blue-50">Keep my profile as is</button>
          </div>
        )}
        {phase.kind === 'done' && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${phase.kept ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
            {phase.kept ? `Saved to your profile: ${skillName} · ${phase.result.level}.` : 'Not saved. You can find this result in your activity.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LevelResultView({ result }: { result: LevelResult }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-slate-500">Your result for {result.skill.name}</p>
        <p className="text-2xl font-bold text-slate-900">{capitalize(result.level)}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_STYLE[result.confidence]}`}>
          {capitalize(result.confidence)} confidence
        </span>
        {result.note && <p className="mt-1 text-xs text-slate-600">{result.note}</p>}
      </div>
      {result.ladder.length > 0 && (
        <ul className="space-y-1.5">
          {result.ladder.map((rung) => (
            <li key={rung.level} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-xs">
              <span className="capitalize text-slate-600">{rung.level}</span>
              <span className="flex gap-1" aria-label={`${rung.correct} of ${rung.asked} correct`}>
                {(rung.answers.length ? rung.answers : [null, null, null]).map((ok, index) => (
                  <span key={index} aria-hidden="true" className={`grid size-4 place-items-center rounded text-[9px] font-bold ${ok === null ? 'border border-slate-200' : ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {ok === null ? '' : ok ? '✓' : '✕'}
                  </span>
                ))}
              </span>
              <span className={`text-[10px] font-semibold ${rung.status === 'passed' ? 'text-emerald-700' : rung.status === 'not_passed' ? 'text-red-700' : 'text-slate-400'}`}>
                {rung.status === 'passed' ? 'Passed' : rung.status === 'not_passed' ? 'Not passed' : 'Not tested'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">What this measures</p>
        <p>{result.method === 'quiz'
          ? `Knowledge from the official documentation, ${result.asked} single-answer questions, ${result.correct} correct. It does not test hands-on work or job readiness.`
          : 'Your own rating of what you can do. Nothing was tested.'}</p>
        <p>Your self-check suggested {result.selfCheckLevel}.</p>
      </div>
      {result.review.length > 0 && (
        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-800">Answers and sources</summary>
          <div className="mt-2 space-y-3">{result.review.map((review) => <AnswerReviewItem key={review.itemId} review={review} />)}</div>
        </details>
      )}
    </div>
  )
}
