import { useState, type ReactNode } from 'react'
import type { OnboardingData, OnboardingStep, Preferences, Profile } from '../types'
import { DEFAULT_PREFERENCES } from '../../../lib/preferencesConstants'
import { OnboardingContext } from './OnboardingContext'
import { createEmptyProfile } from '../../../lib/api'
import { careerGoalSchema } from '../types'
import { onboardingCopy } from '../../../lib/constants'

const initialData: OnboardingData = {
  cvFile: null,
  targetRole: '',
  deadline: '3_months',
  customDeadlineDate: '',
  preferences: { ...DEFAULT_PREFERENCES },
  profile: createEmptyProfile(),
  profileSource: 'manual',
}

type OnboardingProviderProps = {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [navigation, setNavigation] = useState<{ currentStep: OnboardingStep; lastCompletedStep: OnboardingStep | 0 }>({ currentStep: 1, lastCompletedStep: 0 })
  const [data, setData] = useState<OnboardingData>(initialData)
  const { currentStep, lastCompletedStep } = navigation
  const availableSteps = onboardingCopy.steps.map(({ id }) => id).filter((step) =>
    step <= lastCompletedStep && (step <= 2 || data.profile.user_confirmed) &&
    (step <= 3 || careerGoalSchema.safeParse(data).success),
  )

  function nextStep() {
    setNavigation((current) => {
      if (current.currentStep === 5) return current
      return {
        currentStep: (current.currentStep + 1) as OnboardingStep,
        lastCompletedStep: Math.max(current.lastCompletedStep, current.currentStep) as OnboardingStep,
      }
    })
  }

  function previousStep() {
    setNavigation((current) => ({ ...current,
      currentStep: current.currentStep > 1 ? (current.currentStep - 1) as OnboardingStep : current.currentStep,
    }))
  }

  function goToStep(step: OnboardingStep) {
    if (availableSteps.includes(step)) setNavigation((current) => ({ ...current, currentStep: step }))
  }

  function updateData(updates: Partial<OnboardingData>) {
    setData((currentData) => ({ ...currentData, ...updates }))
  }

  function resetOnboarding() {
    setNavigation({ currentStep: 1, lastCompletedStep: 0 })
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
        availableSteps,
        data,
        nextStep,
        previousStep,
        goToStep,
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
