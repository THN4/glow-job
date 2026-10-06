import type { ReactNode } from 'react'
import { TopBar } from '../../../../components/shared/TopBar'
import { OnboardingSidebar } from './OnboardingSidebar'
import { OnboardingStepper } from './OnboardingStepper'
import { StepNavigation } from './StepNavigation'
import type { OnboardingStep } from '../../types'
import { onboardingCopy } from '../../../../lib/constants'
import type { SidebarContent } from './sidebarContent'
import { OnboardingBrandProgress } from './OnboardingBrandProgress'

type OnboardingLayoutProps = {
  currentStep: OnboardingStep
  availableSteps?: readonly OnboardingStep[]
  onStepChange?: (step: OnboardingStep) => void
  children: ReactNode
  onContinue?: () => void
  onBack?: () => void
  onHelp?: () => void
  canContinue?: boolean
  isLoading?: boolean
  continueLabel?: string
  sidebarContent?: SidebarContent
  progressLabel?: string
  analyzing?: boolean
  footer?: ReactNode
}

export function OnboardingLayout({
  currentStep,
  availableSteps,
  onStepChange,
  children,
  onContinue,
  onBack,
  onHelp,
  canContinue = true,
  isLoading = false,
  continueLabel = onboardingCopy.continue,
  sidebarContent,
  progressLabel,
  analyzing = false,
  footer,
}: OnboardingLayoutProps) {
  return (
    <main className="min-h-screen bg-background sidebar-expanded:flex">
      <OnboardingSidebar currentStep={currentStep} content={sidebarContent} progressLabel={progressLabel} analyzing={analyzing} />

      <div className="flex min-w-0 flex-1 flex-col px-3 pb-4 sm:px-6 sm:pb-6 lg:pl-8 lg:pr-6 xl:pl-10 xl:pr-7 xl:pb-8">
        <TopBar onHelp={onHelp} leading={<OnboardingBrandProgress currentStep={currentStep} progressLabel={progressLabel} analyzing={analyzing} compact />} />

        <section className="mx-auto mt-4 flex w-full flex-1 flex-col rounded-2xl border border-border bg-card px-4 py-6 sm:px-7 sm:py-8 xl:rounded-3xl xl:px-11 xl:pb-7 xl:pt-11">
          <div className="w-full">
            <OnboardingStepper currentStep={currentStep} analyzing={analyzing} availableSteps={availableSteps} onStepChange={onStepChange} />
          </div>

          <div className="mt-7 flex w-full flex-1 flex-col">
            {children}
          </div>

          {(footer !== undefined || onContinue) && <div className="mt-5 w-full">
            {footer ?? (onContinue &&
            <StepNavigation
              onBack={onBack}
              onContinue={onContinue}
              canContinue={canContinue}
              isLoading={isLoading}
              continueLabel={continueLabel}
            />)}
          </div>}
        </section>
      </div>
    </main>
  )
}
