import { useState } from 'react'
import type { Question } from '../types'

type QuestionCardProps = {
  question: Question
  /** Line above the question, e.g. "Question 2 of 4 · about the task “What is a DAG?”". */
  label: string
  progress: number
  submitLabel: string
  busy?: boolean
  onAnswer: (choice: number) => void
}

export function QuestionCard({ question, label, progress, submitLabel, busy, onAnswer }: QuestionCardProps) {
  const [choice, setChoice] = useState<number | null>(null)
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => { event.preventDefault(); if (choice !== null) onAnswer(choice) }}
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="text-xs font-semibold text-blue-700">{label}</p>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-semibold leading-snug text-slate-900">{question.stem}</legend>
        {question.options.map((option, index) => (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${choice === index ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
          >
            <input
              type="radio"
              name={`question-${question.itemId}`}
              checked={choice === index}
              onChange={() => setChoice(index)}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">One correct answer. Answers are shown at the end.</p>
        <button
          type="submit"
          disabled={choice === null || busy}
          className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
