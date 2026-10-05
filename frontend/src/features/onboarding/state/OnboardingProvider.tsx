import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { CurrentStatus, OnboardingData, OnboardingStep, Timeline } from '../types'

type OnboardingContextValue = {
  currentStep: OnboardingStep
  data: OnboardingData
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: OnboardingStep) => void
  updateData: (updates: Partial<OnboardingData>) => void
  resetOnboarding: () => void
}

const initialData: OnboardingData = {
  cvFileName: null,
  targetRole: '',
  timeline: null as Timeline | null,
  currentStatus: null as CurrentStatus | null,
  hoursPerWeek: null,
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

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

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        data,
        nextStep,
        previousStep,
        goToStep: setCurrentStep,
        updateData,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)

  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }

  return context
}