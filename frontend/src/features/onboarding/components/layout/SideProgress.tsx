import { onboardingCopy } from '../../../../lib/constants'
import { cn } from '../../../../lib/utils'
import { getOnboardingStepStatus } from '../../../../lib/onboardingProgress'
import type { OnboardingStep } from '../../types'

type SideProgressProps = { currentStep: OnboardingStep; completedSteps?: readonly OnboardingStep[]; label?: string; analyzing?: boolean; compact?: boolean }

export function SideProgress({ currentStep, completedSteps, label, analyzing = false, compact = false }: SideProgressProps) {
  const progressLabel = label ?? (analyzing ? onboardingCopy.analyzingLabel : onboardingCopy.stepLabel(currentStep))
  return (
    <div>
      <p className={cn('text-foreground', compact ? 'text-[10px] leading-4 sm:text-xs' : 'text-base leading-6', analyzing && 'font-semibold')}>{progressLabel}</p>
      <div className={cn('flex', compact ? 'mt-0.5 gap-1' : 'mt-2 gap-1.5')} role="progressbar" aria-label={onboardingCopy.progressLabel}
        aria-valuemin={0} aria-valuemax={5} aria-valuenow={analyzing ? 1.5 : currentStep} aria-valuetext={progressLabel}>
        {onboardingCopy.steps.map(({ id }) => {
          const status = getOnboardingStepStatus(id, currentStep, completedSteps, analyzing)
          return <span key={id} data-state={status} className={cn('flex-1 rounded-full bg-input/80', compact ? 'h-1.5' : 'h-2.5',
            status === 'completed' && 'bg-primary/70', status === 'current' && 'bg-primary',
            analyzing && id === 2 && 'bg-primary/70')} />
        })}
      </div>
    </div>
  )
}
