import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { OnboardingSidebar } from './OnboardingSidebar'
import { OnboardingStepper } from './OnboardingStepper'
import { StepNavigation } from './StepNavigation'
import type { OnboardingStep } from '../../types'

type OnboardingLayoutProps = {
  currentStep: OnboardingStep
  children: ReactNode
  onContinue: () => void
  onBack?: () => void
  onHelp?: () => void
  canContinue?: boolean
  isLoading?: boolean
  continueLabel?: string
}

export function OnboardingLayout({
  currentStep,
  children,
  onContinue,
  onBack,
  onHelp,
  canContinue = true,
  isLoading = false,
  continueLabel = 'Continue',
}: OnboardingLayoutProps) {
  return (
    <main className="min-h-screen bg-[#f2f8ff] lg:flex">
      <OnboardingSidebar currentStep={currentStep} />

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-5 lg:p-4">
        <header className="mb-2 flex h-10 shrink-0 items-center justify-end">
          <button
            type="button"
            onClick={onHelp}
            className="inline-flex min-h-10 items-center gap-2 px-2 text-sm text-blue-600 hover:text-blue-800"
          >
            <CircleHelp size={17} aria-hidden="true" />
            Need help?
          </button>
        </header>

        <section className="mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-5xl flex-1 flex-col rounded-2xl border border-blue-100 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
          <div className="mx-auto w-full max-w-3xl">
            <OnboardingStepper currentStep={currentStep} />
          </div>

          <div className="mx-auto mt-7 flex w-full max-w-5xl flex-1 flex-col">
            {children}
          </div>

          <div className="mx-auto mt-8 w-full max-w-3xl">
            <StepNavigation
              onBack={onBack}
              onContinue={onContinue}
              canContinue={canContinue}
              isLoading={isLoading}
              continueLabel={continueLabel}
            />
          </div>
        </section>
      </div>
    </main>
  )
}