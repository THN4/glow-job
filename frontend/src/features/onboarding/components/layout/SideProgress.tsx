import { onboardingCopy } from '../../../../lib/constants'
import { cn } from '../../../../lib/utils'
import type { OnboardingStep } from '../../types'

type SideProgressProps = { currentStep: OnboardingStep; label?: string; analyzing?: boolean }

export function SideProgress({ currentStep, label, analyzing = false }: SideProgressProps) {
  const progressLabel = label ?? (analyzing ? onboardingCopy.analyzingLabel : onboardingCopy.stepLabel(currentStep))
  return (
    <div>
      <p className={cn('text-base leading-6 text-foreground', analyzing && 'font-semibold')}>{progressLabel}</p>
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-label={onboardingCopy.progressLabel}
        aria-valuemin={0} aria-valuemax={5} aria-valuenow={analyzing ? 1.5 : currentStep} aria-valuetext={progressLabel}>
        {onboardingCopy.steps.map(({ id }) => (
          <span key={id} className={cn('h-2.5 flex-1 rounded-full bg-input/80',
            id < currentStep && 'bg-primary/70', id === currentStep && 'bg-primary',
            analyzing && id === 2 && 'bg-primary/70')} />
        ))}
      </div>
    </div>
  )
}
