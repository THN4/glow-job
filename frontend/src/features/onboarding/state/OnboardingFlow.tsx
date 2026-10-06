import { useState } from 'react'
import { OnboardingLayout } from '../components/layout/OnboardingLayout'
import { UploadCvStep } from '../pages/steps/UploadCvStep'
import { useOnboarding } from './OnboardingContext'
import { PageHeader } from '../components/layout/PageHeader'
import { onboardingCopy } from '../../../lib/constants'
import { PreferencesStep } from '../pages/steps/PreferencesStep'
import { CareerGoalStep } from '../pages/steps/CareerGoalStep'
import { careerGoalSchema } from '../types'
import { analyzeCv, createEmptyProfile } from '../../../lib/api'
import { reviewCopy } from '../../../lib/profileConstants'
import { ReviewProfileStep } from '../pages/steps/ReviewProfileStep'

export function OnboardingFlow() {
  const {
    currentStep,
    data,
    nextStep,
    previousStep,
    updateData,
    updatePreferences,
    updateProfile,
  } = useOnboarding()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleUpload() {
    if (!data.cvFile || isUploading) return
    if (data.profileSource === 'cv') { nextStep(); return }
    setIsUploading(true)
    setUploadError(null)
    try {
      const profile = await analyzeCv(data.cvFile)
      updateData({ profile, profileSource: 'cv' })
      nextStep()
    } catch {
      setUploadError(reviewCopy.profileLoadError)
    } finally {
      setIsUploading(false)
    }
  }

  const canContinue =
    currentStep === 1 ? Boolean(data.cvFile)
      : currentStep === 3 ? careerGoalSchema.safeParse(data).success : true

  function handleContinue() {
    if (!canContinue) return
    if (currentStep === 5) {
      console.log('Onboarding data:', data)
      return
    }

    if (currentStep === 3) updateData({ targetRole: data.targetRole.trim() })
    if (currentStep === 2) updateData({ profile: { ...data.profile, user_confirmed: true,
      education: data.profile.education ? { ...data.profile.education, confirmed: true } : null,
    } })
    nextStep()
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      onBack={currentStep > 1 ? previousStep : undefined}
      onContinue={currentStep === 1 || currentStep === 2 || currentStep === 4 ? undefined : handleContinue}
      canContinue={canContinue}
      continueLabel={currentStep === 5 ? onboardingCopy.buildRoadmap : onboardingCopy.continue}
    >
      {currentStep === 1 ? (
        <UploadCvStep
          file={data.cvFile}
          onFileSelected={(cvFile) => { setUploadError(null); updateData({ cvFile, profile: createEmptyProfile(), profileSource: 'manual' }) }}
          onUpload={handleUpload}
          isUploading={isUploading}
          uploadError={uploadError}
          onContinueWithoutCv={() => { updateData({ cvFile: null, profileSource: 'manual',
            profile: data.profileSource === 'cv' ? createEmptyProfile() : data.profile,
          }); nextStep() }}
        />
      ) : currentStep === 2 ? (
        <ReviewProfileStep profile={data.profile} source={data.profileSource} onChange={updateProfile}
          onContinue={handleContinue} onBack={previousStep} />
      ) : currentStep === 3 ? (
        <CareerGoalStep targetRole={data.targetRole} deadline={data.deadline}
          onRoleChange={(targetRole) => updateData({ targetRole })}
          onDeadlineChange={(deadline) => updateData({ deadline })} />
      ) : currentStep === 4 ? (
        <PreferencesStep preferences={data.preferences} onChange={updatePreferences} onAnalyze={nextStep} />
      ) : (
        <section>
          <PageHeader {...onboardingCopy.headers[currentStep]} />
          <p className="mt-2 text-sm text-muted-foreground">{onboardingCopy.placeholder}</p>
        </section>
      )}
    </OnboardingLayout>
  )
}
