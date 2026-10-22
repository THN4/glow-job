import { safeSourceUrl } from '../../roadmap/learningSources'
import type { AnswerReview as Review } from '../types'

export function AnswerReviewItem({ review }: { review: Review }) {
  const url = safeSourceUrl(review.source.url)
  const sourceName = review.source.heading && review.source.heading !== review.source.title
    ? `${review.source.title} › ${review.source.heading}` : review.source.title
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-slate-800">{review.stem}</p>
      {!review.correct && review.choice !== null && (
        <p className="text-red-700">Your answer: {review.options[review.choice]}</p>
      )}
      <p className="font-semibold text-emerald-700">Answer: {review.options[review.answerIndex]}</p>
      <blockquote className="border-l-2 border-blue-500 bg-blue-50 px-2 py-1 text-[11px] text-slate-600 [overflow-wrap:anywhere]">
        “{review.quote}”
      </blockquote>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-700 underline [overflow-wrap:anywhere]">
          {sourceName}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : <p className="text-[11px] text-slate-500">{sourceName}</p>}
    </div>
  )
}
