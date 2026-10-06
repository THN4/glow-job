import { Check } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { Button } from '../../../../components/ui/button'
import { cn } from '../../../../lib/utils'
import type { OnboardingStep } from '../../types'

type OnboardingStepperProps = {
  currentStep: OnboardingStep
  analyzing?: boolean
  availableSteps?: readonly OnboardingStep[]
  onStepChange?: (step: OnboardingStep) => void
}

export function OnboardingStepper({ currentStep, analyzing = false, availableSteps = [], onStepChange }: OnboardingStepperProps) {
  return (
    <nav aria-label={onboardingCopy.progressLabel}>
      <ol className="grid grid-cols-5">
        {onboardingCopy.steps.map((step, index) => {
          const isCurrent = step.id === currentStep
          const isComplete = !isCurrent && (step.id < currentStep || availableSteps.includes(step.id)) || (analyzing && step.id === 1)
          const canNavigate = !analyzing && !isCurrent && Boolean(onStepChange) && availableSteps.includes(step.id)
          return (
            <li key={step.id}
              aria-label={onboardingCopy.stepAnnouncement(step.id, step.label)}
              className="relative flex min-w-0 flex-col items-center text-center">
              {index < onboardingCopy.steps.length - 1 && (
                <span aria-hidden="true" className={cn(
                  'absolute left-[calc(50%+1.35rem)] top-[22px] h-0.5 w-[calc(100%-2.7rem)] bg-border sm:left-[calc(50%+2rem)] sm:w-[calc(100%-4rem)]',
                  isComplete && 'bg-primary')} />
              )}
              <Button type="button" variant="ghost" disabled={!canNavigate} onClick={() => onStepChange?.(step.id)}
                aria-label={onboardingCopy.stepAnnouncement(step.id, step.label)} aria-current={isCurrent ? 'step' : undefined}
                className="group relative size-11 shrink-0 rounded-full p-0 hover:bg-transparent disabled:opacity-100">
                <span className={cn(
                'relative flex size-8 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground sm:size-9',
                (isComplete || isCurrent) && 'bg-primary text-primary-foreground', isCurrent && 'shadow-sm',
                canNavigate && 'group-hover:ring-2 group-hover:ring-primary/30')}>
                {isComplete ? <Check className="size-5" strokeWidth={3} aria-hidden="true" /> : step.id}
                </span>
              </Button>
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
