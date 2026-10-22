import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { loadCareerProfiles, saveCareerGoal, saveMatchedCareerGoal, saveProfile, type CareerProfileOption, type CvProfile } from '../../resume/api'
import { toSavedCvProfile } from '../api/profilePersistence'

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
  const extractedProfile = useRef<CvProfile | undefined>(undefined)
  const saving = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [goalSaved, setGoalSaved] = useState(false)
  const [careerProfileMatched, setCareerProfileMatched] = useState<boolean | null>(null)

  function findCareerProfile(options: CareerProfileOption[], targetRole: string) {
    const normalize = (value: string) => value.toLocaleLowerCase().replace(/\b(internship|intern|junior|entry level|entry-level|graduate|senior|mid level|mid-level)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const target = normalize(targetRole)
    return options.find((option) => normalize(option.careerName) === target)
      ?? options.find((option) => normalize(option.profileName) === target)
  }

  function getTargetDate() {
    const today = new Date()
    const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (data.deadline === 'custom') return data.customDeadlineDate > todayText ? data.customDeadlineDate : null
    const months = data.deadline === '3_months' ? 3 : data.deadline === '6_months' ? 6 : 12
    const date = today
    date.setMonth(date.getMonth() + months)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function getReadinessTimeframe(): 'three_months' | 'six_months' | 'one_year' | 'no_fixed_deadline' {
    if (data.deadline !== 'custom') {
      return data.deadline === '3_months' ? 'three_months' : data.deadline === '6_months' ? 'six_months' : 'one_year'
    }
    const months = (new Date(data.customDeadlineDate).getFullYear() - new Date().getFullYear()) * 12
      + new Date(data.customDeadlineDate).getMonth() - new Date().getMonth()
    return months <= 3 ? 'three_months' : months <= 6 ? 'six_months' : 'one_year'
  }

  useEffect(() => () => analysisController.current?.abort(), [])

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
      setCareerProfileMatched(null)
      setSaveError(null)
      try {
        const targetRole = data.targetRole.trim()
        await saveCareerGoal({
          targetRole,
          deadline: data.deadline,
          customDeadlineDate: data.deadline === 'custom' ? data.customDeadlineDate : null,
          ...data.preferences,
        })
        const careerProfiles = await loadCareerProfiles()
        const careerProfile = findCareerProfile(careerProfiles, targetRole)
        if (careerProfile) {
          const hours = {
            under_2: { band: 'under_2_hours' as const, hours: 1 },
            '2_to_5': { band: 'hours_2_to_5' as const, hours: 3.5 },
            '5_to_10': { band: 'hours_5_to_10' as const, hours: 7.5 },
            over_10: { band: 'hours_10_plus' as const, hours: 12 },
          }[data.preferences.hoursPerWeek]
          await saveMatchedCareerGoal({
            careerProfileId: careerProfile.careerProfileId,
            targetRoleTitle: targetRole,
            readinessTimeframe: getReadinessTimeframe(),
            targetDate: getTargetDate(),
            weeklyAvailability: hours.band,
            availableHoursPerWeek: hours.hours,
            preferredLearningStyle: ({ courses: 'structured_courses', projects: 'hands_on_projects', reading: 'reading_articles', videos: 'videos_tutorials' } as const)[data.preferences.learningStyle],
            additionalContext: data.preferences.notes,
          })
        }
        setCareerProfileMatched(Boolean(careerProfile))
        setGoalSaved(true)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'บันทึกเป้าหมายและ Preferences ไม่สำเร็จ กรุณาลองอีกครั้ง')
      } finally {
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
      continueLabel={isSaving ? 'Saving...' : currentStep === 4 ? preferencesCopy.analyze : currentStep === 5 ? onboardingCopy.buildRoadmap : onboardingCopy.continue}
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
          {goalSaved && (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <p className="text-sm font-medium text-emerald-700" role="status">{careerProfileMatched ? 'Career goal saved and linked to market scoring.' : 'Career goal and preferences saved. This role is not in the scoring catalog yet.'}</p>
              <Link to="/app/overview" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Go to your overview
              </Link>
            </div>
          )}
          {saveError && <p className="mt-4 text-sm text-destructive" role="alert">{saveError}</p>}
        </section>
      )}
    </OnboardingLayout>
  )
}
