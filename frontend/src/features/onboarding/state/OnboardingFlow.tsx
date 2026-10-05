import { OnboardingLayout } from '../components/layout/OnboardingLayout'
import { UploadCvStep } from '../pages/steps/UploadCvStep'
import { useOnboarding } from './OnboardingProvider'
import type { OnboardingStep } from '../types'

const stepTitles: Record<OnboardingStep, string> = {
  1: 'Upload CV',
  2: 'Review Profile',
  3: 'Career Goal',
  4: 'Preferences',
  5: 'Confirmation',
}

export function OnboardingFlow() {
  const {
    currentStep,
    data,
    nextStep,
    previousStep,
    updateData,
  } = useOnboarding()

  const canContinue =
    currentStep === 1 ? Boolean(data.cvFileName) : true

  function handleContinue() {
    if (currentStep === 5) {
      console.log('Onboarding data:', data)
      return
    }

    nextStep()
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      onBack={currentStep > 1 ? previousStep : undefined}
      onContinue={handleContinue}
      canContinue={canContinue}
      continueLabel={currentStep === 5 ? 'Build my roadmap' : 'Continue'}
    >
      {currentStep === 1 ? (
        <UploadCvStep
          fileName={data.cvFileName}
          onFileSelected={(fileName) => updateData({ cvFileName: fileName })}
          onContinueWithoutCv={nextStep}
        />
      ) : (
        <section>
          <h1 className="text-2xl font-bold text-slate-900">
            {stepTitles[currentStep]}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This step is ready for the team to build.
          </p>
        </section>
      )}
    </OnboardingLayout>
  )
}