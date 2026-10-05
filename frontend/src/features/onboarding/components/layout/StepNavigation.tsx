import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react'

type StepNavigationProps = {
  onBack?: () => void
  onContinue: () => void
  canContinue?: boolean
  isLoading?: boolean
  continueLabel?: string
  backLabel?: string
}

export function StepNavigation({
  onBack,
  onContinue,
  canContinue = true,
  isLoading = false,
  continueLabel = 'Continue',
  backLabel = 'Back',
}: StepNavigationProps) {
  return (
    <footer className="flex w-full items-center justify-between gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || isLoading}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-none sm:min-w-48"
      >
        {isLoading && (
          <LoaderCircle
            size={16}
            className="animate-spin"
            aria-hidden="true"
          />
        )}
        {continueLabel}
        {!isLoading && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </footer>
  )
}