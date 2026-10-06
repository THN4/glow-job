import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { onboardingCopy } from '../../../../lib/constants'

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
  continueLabel = onboardingCopy.continue,
  backLabel = onboardingCopy.back,
}: StepNavigationProps) {
  return (
    <footer className="flex w-full items-center justify-between gap-3">
      {onBack ? (
        <Button
          variant="outline"
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="h-12 gap-2 border-input bg-card px-5 text-base text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Button>
      ) : (
        <span />
      )}

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || isLoading}
        className="h-12 flex-1 gap-3 px-6 text-base font-semibold sm:flex-none sm:min-w-60"
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
      </Button>
    </footer>
  )
}
