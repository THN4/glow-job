import type { OnboardingStep } from '../features/onboarding/types'

export function getOnboardingStepStatus(
  step: OnboardingStep,
  currentStep: OnboardingStep,
  completedSteps?: readonly OnboardingStep[],
  analyzing = false,
): 'current' | 'completed' | 'upcoming' {
  if (analyzing && step === 1) return 'completed'
  if (step === currentStep) return 'current'
  return (completedSteps ? completedSteps.includes(step) : step < currentStep) ? 'completed' : 'upcoming'
}
