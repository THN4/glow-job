import { Check } from 'lucide-react'
import type { OnboardingStep } from '../../types'

type OnboardingStepperProps = {
  currentStep: OnboardingStep
}

const steps: {
  id: OnboardingStep
  label: string
  shortLabel: string
}[] = [
  { id: 1, label: 'Upload CV', shortLabel: 'CV' },
  { id: 2, label: 'Review Profile', shortLabel: 'Review' },
  { id: 3, label: 'Career Goal', shortLabel: 'Goal' },
  { id: 4, label: 'Preferences', shortLabel: 'Prefs' },
  { id: 5, label: 'Confirmation', shortLabel: 'Done' },
]

export function OnboardingStepper({
  currentStep,
}: OnboardingStepperProps) {
  return (
    <nav aria-label="Onboarding progress">
      <ol className="grid grid-cols-5">
        {steps.map((step, index) => {
          const isComplete = step.id < currentStep
          const isCurrent = step.id === currentStep

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${step.id}: ${step.label}`}
              className="relative flex flex-col items-center text-center"
            >
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-3 h-px w-full ${
                    isComplete ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              )}

              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isComplete
                    ? 'bg-blue-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-100 text-slate-500'
                }`}
              >
                {isComplete ? <Check size={14} /> : step.id}
              </span>

              <span
                className={`mt-1 whitespace-nowrap text-[10px] sm:text-xs ${
                  isCurrent
                    ? 'font-medium text-blue-700'
                    : 'text-slate-500'
                }`}
              >
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