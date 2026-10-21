import { useEffect, useRef, useState } from 'react'
import { OnboardingLayout } from '../components/layout/OnboardingLayout'
import { UploadCvStep } from '../pages/steps/UploadCvStep'
import { useOnboarding } from './OnboardingContext'
import { PageHeader } from '../components/layout/PageHeader'
import { onboardingCopy } from '../../../lib/constants'
import { PreferencesStep } from '../pages/steps/PreferencesStep'
import { CareerGoalStep } from '../pages/steps/CareerGoalStep'
import { careerGoalSchema } from '../types'
import { analyzeCv, createEmptyProfile } from '../../../lib/api'
import { ReviewProfileStep } from '../pages/steps/ReviewProfileStep'
import { Sparkles } from 'lucide-react'
import { preferencesCopy } from '../../../lib/preferencesConstants'
import { analysisCopy } from '../../../lib/analysisConstants'
import type { AnalysisStep } from '../analysisTypes'
import { AnalyzingCvStep } from '../pages/steps/AnalyzingCvStep'
import { AnalysisNavigation } from '../components/analysis/AnalysisNavigation'
import { hasRequiredSkillLevels, markProfileReviewed } from '../../../lib/profileReview'
import { focusField } from '../../../lib/focusField'

export function OnboardingFlow() {
  const {
    currentStep,
    completedSteps,
    availableSteps,
    goToStep,
    data,
    nextStep,
    previousStep,
    updateData,
    updatePreferences,
    updateProfile,
  } = useOnboarding()
  const [isUploading, setIsUploading] = useState(false)
  const [analysis, setAnalysis] = useState<{ steps: AnalysisStep[]; error: string | null; ready: boolean } | null>(null)
  const analysisController = useRef<AbortController | null>(null)
  const [goalValidationAttempted, setGoalValidationAttempted] = useState(false)

  useEffect(() => () => analysisController.current?.abort(), [])

  function cancelAnalysis() {
    analysisController.current?.abort()
    analysisController.current = null
    setAnalysis(null)
    setIsUploading(false)
  }

  function continueWithoutCv() {
    cancelAnalysis()
    updateData({ cvFile: null, profileSource: 'manual',
      profile: data.profileSource === 'cv' ? createEmptyProfile() : data.profile,
    })
    nextStep()
  }

  async function handleUpload() {
    if (!data.cvFile || analysisController.current) return
    if (data.profileSource === 'cv') {
      setAnalysis({ steps: analysisCopy.steps.map(({ id }) => ({ id, status: 'done' })), error: null, ready: true })
      return
    }
    const controller = new AbortController()
    analysisController.current = controller
    setIsUploading(true)
    setAnalysis({ steps: analysisCopy.steps.map(({ id }) => ({ id, status: 'pending' })), error: null, ready: false })
    try {
      const profile = await analyzeCv(data.cvFile, {
        signal: controller.signal,
        onProgress: (id, status) => {
          if (controller.signal.aborted) return
          setAnalysis((current) => current && ({ ...current,
            steps: current.steps.map((step) => step.id === id ? { ...step, status } : step),
          }))
        },
      })
      if (controller.signal.aborted) return
      updateData({ profile, profileSource: 'cv' })
      setAnalysis((current) => current && ({ ...current, ready: true }))
    } catch {
      if (controller.signal.aborted) return
      setAnalysis((current) => current && ({ ...current,
        error: analysisCopy.errors.generic,
      }))
    } finally {
      if (analysisController.current === controller) {
        analysisController.current = null
        setIsUploading(false)
      }
    }
  }

  function continueToReview() {
    if (!analysis?.ready) return
    setAnalysis(null)
    nextStep()
  }

  const canContinue =
    currentStep === 1 ? Boolean(data.cvFile)
      : currentStep === 2 ? hasRequiredSkillLevels(data.profile)
        : currentStep === 3 ? careerGoalSchema.safeParse(data).success : true

  function handleContinue() {
    if (!canContinue) {
      if (currentStep === 3) {
        setGoalValidationAttempted(true)
        requestAnimationFrame(() => focusField(document.querySelector('[data-onboarding-field][aria-invalid="true"]')?.closest<HTMLElement>('section[aria-labelledby]'), 'start'))
      }
      return
    }
    if (currentStep === 5) {
      console.log('Onboarding data:', data)
      return
    }

    if (currentStep === 3) updateData({ targetRole: data.targetRole.trim() })
    if (currentStep === 2) updateData({ profile: markProfileReviewed(data.profile) })
    nextStep()
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      completedSteps={completedSteps}
      availableSteps={availableSteps}
      onStepChange={analysis ? undefined : goToStep}
      onBack={currentStep > 1 ? previousStep : undefined}
      onContinue={currentStep === 1 || currentStep === 2 ? undefined : handleContinue}
      continueLabel={currentStep === 4 ? preferencesCopy.analyze : currentStep === 5 ? onboardingCopy.buildRoadmap : onboardingCopy.continue}
      continueIcon={currentStep === 4 ? Sparkles : undefined}
      analyzing={Boolean(analysis)}
      footer={analysis && (analysis.ready || analysis.error) ? <AnalysisNavigation failed={Boolean(analysis.error)} ready={analysis.ready} onCancel={cancelAnalysis}
        onRetry={handleUpload} onManual={continueWithoutCv} onContinue={continueToReview} /> : undefined}
    >
      {analysis ? <AnalyzingCvStep steps={analysis.steps} error={analysis.error} ready={analysis.ready} /> : currentStep === 1 ? (
        <UploadCvStep
          file={data.cvFile}
          onFileSelected={(cvFile) => { updateData({ cvFile, profile: createEmptyProfile(), profileSource: 'manual' }) }}
          onUpload={handleUpload}
          isUploading={isUploading}
          onContinueWithoutCv={continueWithoutCv}
        />
      ) : currentStep === 2 ? (
        <ReviewProfileStep profile={data.profile} source={data.profileSource} onChange={updateProfile}
          onContinue={handleContinue} onBack={previousStep} />
      ) : currentStep === 3 ? (
        <CareerGoalStep targetRole={data.targetRole} deadline={data.deadline}
          showValidation={goalValidationAttempted}
          customDeadlineDate={data.customDeadlineDate}
          onRoleChange={(targetRole) => updateData({ targetRole })}
          onDeadlineChange={(deadline) => updateData({ deadline })}
          onCustomDeadlineDateChange={(customDeadlineDate) => updateData({ customDeadlineDate })} />
      ) : currentStep === 4 ? (
        <PreferencesStep preferences={data.preferences} onChange={updatePreferences} />
      ) : (
        <section>
          <PageHeader {...onboardingCopy.headers[currentStep]} />
          <p className="mt-2 text-sm text-muted-foreground">{onboardingCopy.placeholder}</p>
        </section>
      )}
    </OnboardingLayout>
  )
}
