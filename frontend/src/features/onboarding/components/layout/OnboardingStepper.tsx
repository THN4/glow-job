import { Check } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { cn } from '../../../../lib/utils'
import type { OnboardingStep } from '../../types'

type OnboardingStepperProps = { currentStep: OnboardingStep; analyzing?: boolean }

export function OnboardingStepper({ currentStep, analyzing = false }: OnboardingStepperProps) {
  return (
    <nav aria-label={onboardingCopy.progressLabel}>
      <ol className="grid grid-cols-5">
        {onboardingCopy.steps.map((step, index) => {
          const isComplete = step.id < currentStep || (analyzing && step.id === 1)
          const isCurrent = step.id === currentStep
          return (
            <li key={step.id} aria-current={isCurrent ? 'step' : undefined}
              aria-label={onboardingCopy.stepAnnouncement(step.id, step.label)}
              className="relative flex min-w-0 flex-col items-center text-center">
              {index < onboardingCopy.steps.length - 1 && (
                <span aria-hidden="true" className={cn(
                  'absolute left-[calc(50%+1.35rem)] top-4 h-0.5 w-[calc(100%-2.7rem)] bg-border sm:left-[calc(50%+2rem)] sm:top-[18px] sm:w-[calc(100%-4rem)]',
                  isComplete && 'bg-primary')} />
              )}
              <span className={cn(
                'relative flex size-8 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground sm:size-9',
                (isComplete || isCurrent) && 'bg-primary text-primary-foreground', isCurrent && 'shadow-sm')}>
                {isComplete ? <Check className="size-5" strokeWidth={3} aria-hidden="true" /> : step.id}
              </span>
              <span className={cn('mt-2 text-xs leading-5 text-muted-foreground sm:text-sm xl:text-base', (isCurrent || isComplete) && 'text-primary')}>
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
