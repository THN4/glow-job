import { useState, type ReactNode } from 'react'
import type { OnboardingData, OnboardingStep, Preferences, Profile } from '../types'
import { DEFAULT_PREFERENCES } from '../../../lib/preferencesConstants'
import { OnboardingContext } from './OnboardingContext'
import { createEmptyProfile } from '../../../lib/api'

const initialData: OnboardingData = {
  cvFile: null,
  targetRole: '',
  deadline: '3_months',
  preferences: { ...DEFAULT_PREFERENCES },
  profile: createEmptyProfile(),
  profileSource: 'manual',
}

type OnboardingProviderProps = {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [data, setData] = useState<OnboardingData>(initialData)

  function nextStep() {
    setCurrentStep((step) => (step < 5 ? ((step + 1) as OnboardingStep) : step))
  }

  function previousStep() {
    setCurrentStep((step) => (step > 1 ? ((step - 1) as OnboardingStep) : step))
  }

  function updateData(updates: Partial<OnboardingData>) {
    setData((currentData) => ({ ...currentData, ...updates }))
  }

  function resetOnboarding() {
    setCurrentStep(1)
    setData(initialData)
  }

  function updatePreferences(updates: Partial<Preferences>) {
    setData((currentData) => ({
      ...currentData,
      preferences: { ...currentData.preferences, ...updates },
    }))
  }

  function updateProfile(updates: Partial<Profile>) {
    setData((currentData) => ({ ...currentData,
      profile: { ...currentData.profile, ...updates, user_confirmed: false },
    }))
  }

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        data,
        nextStep,
        previousStep,
        goToStep: setCurrentStep,
        updateData,
        updatePreferences,
        updateProfile,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}
