import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OnboardingLayout } from '../components/layout/OnboardingLayout'
import { UploadCvStep } from '../pages/steps/UploadCvStep'
import { useOnboarding } from './OnboardingContext'
import { PageHeader } from '../components/layout/PageHeader'
import { onboardingCopy } from '../../../lib/constants'
import { PreferencesStep } from '../pages/steps/PreferencesStep'
import { CareerGoalStep } from '../pages/steps/CareerGoalStep'
import { careerGoalSchema } from '../types'
import { createEmptyProfile } from '../../../lib/api'
import { analyzeOnboardingCv } from '../api/cvAnalysisApi'
import { ReviewProfileStep } from '../pages/steps/ReviewProfileStep'
import { Sparkles } from 'lucide-react'
import { preferencesCopy } from '../../../lib/preferencesConstants'
import { analysisCopy } from '../../../lib/analysisConstants'
import type { AnalysisStep } from '../analysisTypes'
import { AnalyzingCvStep } from '../pages/steps/AnalyzingCvStep'
import { AnalysisNavigation } from '../components/analysis/AnalysisNavigation'
import { hasRequiredSkillLevels, markProfileReviewed } from '../../../lib/profileReview'
import { focusField } from '../../../lib/focusField'
import { hasProfileInformation } from '../profileFromCv'
import { loadCareerProfiles, saveProfile, type CvProfile } from '../../resume/api'
import { toSavedCvProfile } from '../api/profilePersistence'
import { generateRoadmap, saveRoadmapGoal } from '../../roadmap/api'

export function OnboardingFlow() {
  const navigate = useNavigate()
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
  const extractedProfile = useRef<CvProfile | undefined>(undefined)
  const saving = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [goalSaved, setGoalSaved] = useState(false)
  const [roadmapStage, setRoadmapStage] = useState<string | null>(null)
  const roadmapController = useRef<AbortController | null>(null)
  const [supportedRoles, setSupportedRoles] = useState<string[]>([])

  useEffect(() => () => analysisController.current?.abort(), [])
  useEffect(() => () => roadmapController.current?.abort(), [])
  useEffect(() => {
    let active = true
    void loadCareerProfiles().then((careers) => {
      if (active) setSupportedRoles([...new Set(careers.map((career) => career.profileName))])
    }).catch(() => { /* The save action reports catalog errors if it is still unavailable. */ })
    return () => { active = false }
  }, [])

  function cancelAnalysis() {
    analysisController.current?.abort()
    analysisController.current = null
    setAnalysis(null)
    setIsUploading(false)
  }

  function continueWithoutCv() {
    cancelAnalysis()
    extractedProfile.current = undefined
    setSaveError(null)
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
      const result = await analyzeOnboardingCv(data.cvFile, {
        signal: controller.signal,
        onProgress: (id, status) => {
          if (controller.signal.aborted) return
          const activeIndex = analysisCopy.steps.findIndex((step) => step.id === id)
          setAnalysis((current) => current && ({ ...current,
            steps: current.steps.map((step, index) => ({
              ...step,
              status: index < activeIndex ? 'done' : index === activeIndex ? status : 'pending',
            })),
          }))
        },
      })
      if (controller.signal.aborted) return
      extractedProfile.current = result.cvProfile
      updateData({ profile: result.profile, profileSource: 'cv' })
      setAnalysis((current) => current && ({
        ...current,
        steps: current.steps.map((step) => ({ ...step, status: 'done' })),
        ready: true,
      }))
    } catch (caught) {
      if (controller.signal.aborted) return
      setAnalysis((current) => current && ({ ...current,
        error: caught instanceof Error ? caught.message : analysisCopy.errors.generic,
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

  async function handleContinue() {
    if (saving.current) return
    if (!canContinue) {
      if (currentStep === 3) {
        setGoalValidationAttempted(true)
        requestAnimationFrame(() => focusField(document.querySelector('[data-onboarding-field][aria-invalid="true"]')?.closest<HTMLElement>('section[aria-labelledby]'), 'start'))
      }
      return
    }
    if (currentStep === 5) {
      saving.current = true
      setIsSaving(true)
      setGoalSaved(false)
      setSaveError(null)
      try {
        await saveRoadmapGoal({
          targetRole: data.targetRole.trim(),
          deadline: data.deadline,
          customDeadlineDate: data.deadline === 'custom' ? data.customDeadlineDate : null,
          ...data.preferences,
        })
        setGoalSaved(true)
        const controller = new AbortController()
        roadmapController.current = controller
        await generateRoadmap(setRoadmapStage, controller.signal)
        navigate('/app/roadmap')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSaveError(error instanceof Error ? error.message : 'สร้าง roadmap ไม่สำเร็จ กรุณาลองอีกครั้ง')
        }
      } finally {
        roadmapController.current = null
        setRoadmapStage(null)
        saving.current = false
        setIsSaving(false)
      }
      return
    }

    if (currentStep === 3) updateData({ targetRole: data.targetRole.trim() })
    if (currentStep === 2) {
      saving.current = true
      setIsSaving(true)
      setSaveError(null)
      try {
        const reviewed = markProfileReviewed(data.profile)
        await saveProfile(toSavedCvProfile(reviewed, extractedProfile.current))
        updateData({ profile: reviewed })
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง')
        return
      } finally {
        saving.current = false
        setIsSaving(false)
      }
    }
    nextStep()
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      completedSteps={completedSteps}
      availableSteps={availableSteps}
      onStepChange={analysis || isSaving ? undefined : goToStep}
      onBack={currentStep > 1 && !isSaving ? previousStep : undefined}
      onContinue={currentStep === 1 || currentStep === 2 ? undefined : handleContinue}
      continueLabel={isSaving ? roadmapStage ? `Building roadmap: ${roadmapStage}...` : 'Saving...' : currentStep === 4 ? preferencesCopy.analyze : currentStep === 5 ? onboardingCopy.buildRoadmap : onboardingCopy.continue}
      isLoading={isSaving}
      continueIcon={currentStep === 4 ? Sparkles : undefined}
      analyzing={Boolean(analysis)}
      footer={analysis && (analysis.ready || analysis.error) ? <AnalysisNavigation failed={Boolean(analysis.error)} ready={analysis.ready} onCancel={cancelAnalysis}
        onRetry={handleUpload} onManual={continueWithoutCv} onContinue={continueToReview} /> : undefined}
    >
      {analysis ? <AnalyzingCvStep steps={analysis.steps} error={analysis.error} ready={analysis.ready} /> : currentStep === 1 ? (
        <UploadCvStep
          file={data.cvFile}
          onFileSelected={(cvFile) => { extractedProfile.current = undefined; setSaveError(null); updateData({ cvFile, profile: createEmptyProfile(), profileSource: 'manual' }) }}
          onUpload={handleUpload}
          isUploading={isUploading}
          onContinueWithoutCv={continueWithoutCv}
        />
      ) : currentStep === 2 ? (
        <ReviewProfileStep profile={data.profile} source={data.profileSource} onChange={updateProfile}
          isSaving={isSaving} saveError={saveError}
          onContinue={handleContinue} onBack={previousStep} />
      ) : currentStep === 3 ? (
        <CareerGoalStep targetRole={data.targetRole} deadline={data.deadline}
          hasProfileInformation={hasProfileInformation(data.profile)}
          supportedRoles={supportedRoles}
          showValidation={goalValidationAttempted}
          customDeadlineDate={data.customDeadlineDate}
          onRoleChange={(targetRole) => updateData({ targetRole })}
          onDeadlineChange={(deadline) => updateData({ deadline })}
          onCustomDeadlineDateChange={(customDeadlineDate) => updateData({ customDeadlineDate })} />
      ) : currentStep === 4 ? (
        <PreferencesStep preferences={data.preferences} onChange={updatePreferences} />
      ) : (
        <section>
          <PageHeader {...(currentStep === 5 ? {
            title: roadmapStage ? 'Building your roadmap' : saveError ? 'We couldn’t build your roadmap yet' : isSaving ? 'Saving your goal' : 'Ready to build your roadmap',
            subtitle: roadmapStage
              ? 'We’re matching your profile with career requirements and finding cited learning content.'
              : saveError
                ? goalSaved ? 'Your goal is saved. Retry to generate the roadmap.' : 'We couldn’t save your goal and prepare the roadmap. Please try again.'
                : isSaving ? 'Your saved profile and preferences are being prepared.'
                  : 'Your profile and preferences are ready. Build a personalized roadmap from your skill gaps and learning documents.',
          } : onboardingCopy.headers[currentStep])} />
          {roadmapStage && <p className="mt-4 text-sm font-medium text-blue-700" role="status">Creating your roadmap: {roadmapStage}...</p>}
          {goalSaved && saveError && <p className="mt-4 text-sm font-medium text-emerald-700" role="status">Career goal and preferences are saved.</p>}
          {saveError && <p className="mt-4 text-sm text-destructive" role="alert">{saveError}</p>}
        </section>
      )}
    </OnboardingLayout>
  )
}
