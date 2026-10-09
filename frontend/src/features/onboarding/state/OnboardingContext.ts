import { createContext, useContext } from 'react'
import type { OnboardingData, OnboardingStep, Preferences, Profile } from '../types'

type OnboardingContextValue = {
  currentStep: OnboardingStep
  completedSteps: readonly OnboardingStep[]
  availableSteps: readonly OnboardingStep[]
  data: OnboardingData
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: OnboardingStep) => void
  updateData: (updates: Partial<OnboardingData>) => void
  updatePreferences: (updates: Partial<Preferences>) => void
  updateProfile: (updates: Partial<Profile>) => void
  resetOnboarding: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}
