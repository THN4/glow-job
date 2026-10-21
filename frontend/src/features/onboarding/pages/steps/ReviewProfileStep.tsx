import { useRef, useState, type MouseEvent } from 'react'
import { Award, BriefcaseBusiness, CircleAlert, Code2, GraduationCap, NotebookText, Sparkles } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { SkillChip } from '../../../../components/shared/SkillChip'
import { StatusTag } from '../../../../components/shared/StatusTag'
import { onboardingCopy } from '../../../../lib/constants'
import { StepNavigation } from '../../components/layout/StepNavigation'
import { reviewCopy } from '../../../../lib/profileConstants'
import { PageHeader } from '../../components/layout/PageHeader'
import { EditSectionDialog } from '../../components/review/EditSectionDialog'
import { InfoCard } from '../../components/review/InfoCard'
import { TechnicalSkillsEditor } from '../../components/review/TechnicalSkillsEditor'
import type { Profile, ProfileSection } from '../../types'
import { analysisCopy } from '../../../../lib/analysisConstants'
import { hasRequiredSkillLevels } from '../../../../lib/profileReview'
import { focusField } from '../../../../lib/focusField'

type ReviewProfileStepProps = {
  profile: Profile
  source: 'cv' | 'manual'
  onChange: (updates: Partial<Profile>) => void
  onContinue: () => void
  onBack: () => void
}

function SkillChips({ skills }: { skills: string[] }) {
  return <div className="flex flex-wrap gap-2">{skills.map((skill) => <SkillChip key={skill}>{skill}</SkillChip>)}</div>
}

export function ReviewProfileStep({ profile, source, onChange, onContinue, onBack }: ReviewProfileStepProps) {
  const [editing, setEditing] = useState<ProfileSection | 'all' | null>(null)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const skillsBlock = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const skillLevelsComplete = hasRequiredSkillLevels(profile)
  function openEditor(section: ProfileSection | 'all', event: MouseEvent<HTMLButtonElement>) {
    returnFocus.current = event.currentTarget
    setEditing(section)
  }
  function continueAfterReview() {
    if (!skillLevelsComplete) {
      setValidationAttempted(true)
      requestAnimationFrame(() => focusField(skillsBlock.current, 'start'))
      return
    }
    onContinue()
  }
  return <div className="flex flex-1 flex-col">
    <PageHeader {...(source === 'cv' ? { ...onboardingCopy.headers[2], subtitle: analysisCopy.reviewNotice } : reviewCopy.manualHeader)}
      badge={source === 'cv' ? <StatusTag icon={Sparkles} variant="info">{reviewCopy.autofilled}</StatusTag> : undefined} />
    <p className="mb-4 flex items-start gap-2 rounded-lg border border-warning/20 bg-icon-amber/50 p-3 text-sm leading-5 text-foreground">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />{reviewCopy.reviewWarning}
    </p>
    <div className="grid gap-4 xl:grid-cols-2">
      <InfoCard title={reviewCopy.titles.education} icon={GraduationCap} color="green" className="xl:min-h-44"
        onEdit={(event) => openEditor('education', event)}>
        <div className="space-y-1 px-1">
          {profile.education ? <>
            <h3 className="break-words text-base font-semibold leading-6">{profile.education.degree}</h3>
            <p className="break-words text-sm leading-5 text-muted-foreground">{profile.education.school}</p>
            {profile.education.period && <p className="text-sm leading-5 text-muted-foreground">{profile.education.period}</p>}
          </> : <p className="py-3 text-muted-foreground">{reviewCopy.empty.education}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.skills} icon={Code2} color="purple" className="xl:min-h-44"
        ref={skillsBlock} invalid={validationAttempted && !skillLevelsComplete}
        onEdit={(event) => openEditor('skills', event)}>
        <div className="space-y-2 px-1">
          <TechnicalSkillsEditor skills={profile.skills} onChange={(skills) => onChange({ skills })} />
          {!skillLevelsComplete && <p role={validationAttempted ? 'alert' : undefined} className="text-sm leading-5 text-warning">{reviewCopy.skillLevelsEditHint}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.projects} icon={NotebookText} color="pink" className="xl:min-h-49"
        onEdit={(event) => openEditor('projects', event)}>
        <div className="space-y-4 px-1">
          {profile.projects.length ? profile.projects.map((project, index) => <article key={index} className="space-y-2">
            <h3 className="break-words text-base font-semibold leading-6">{project.name}</h3>
            {project.description && <p className="break-words text-sm leading-5 text-muted-foreground">{project.description}</p>}
            <SkillChips skills={project.skills} />
          </article>) : <p className="py-3 text-muted-foreground">{reviewCopy.empty.projects}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.experience} icon={BriefcaseBusiness} color="blue" className="xl:min-h-49"
        onEdit={(event) => openEditor('experience', event)}>
        <div className="space-y-4 px-1">
          {profile.experience.length ? profile.experience.map((experience, index) => <article key={index} className="space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-base font-semibold leading-6">{experience.role}</h3>
              {experience.period && <span className="text-sm leading-6 text-muted-foreground">{experience.period}</span>}
            </div>
            <p className="break-words text-sm leading-5 text-muted-foreground">{experience.company}</p>
            {experience.description && <p className="break-words text-sm leading-5 text-muted-foreground">{experience.description}</p>}
            <div className="pt-1"><SkillChips skills={experience.skills} /></div>
          </article>) : <p className="py-3 text-muted-foreground">{reviewCopy.empty.experience}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.certifications} icon={Award} color="amber" className="xl:col-span-2"
        onEdit={(event) => openEditor('certifications', event)}>
        {profile.certifications.length ? <div className="grid gap-4 sm:ml-17 sm:-mt-4 sm:grid-cols-3">
          {profile.certifications.map((certification, index) => <article key={index}
            className="min-w-0 break-words sm:border-l sm:border-input sm:pl-4 sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(3n+1)]:pl-0">
            <h3 className="text-base font-medium leading-5">{certification.name}</h3>
            {certification.details && <p className="mt-1 text-sm leading-5 text-muted-foreground">{certification.details}</p>}
            {certification.outcome && <p className="text-sm leading-5 text-muted-foreground">{certification.outcome}</p>}
          </article>)}
        </div> : <p className="px-1 py-3 text-muted-foreground">{reviewCopy.empty.certifications}</p>}
      </InfoCard>
    </div>
    <div className="@container mt-auto pt-6">
      {!skillLevelsComplete && <p role="status" aria-live="polite" className="mb-3 text-sm leading-5 text-muted-foreground">
        {reviewCopy.skillLevelsBeforeContinue}
      </p>}
      <StepNavigation onBack={onBack} onContinue={continueAfterReview} continueLabel={reviewCopy.continue}
        extraActions={<Button type="button" variant="outline" onClick={(event) => openEditor('all', event)}
          className="h-12 border-input bg-card px-5 text-base text-primary">{reviewCopy.editProfile}</Button>} />
    </div>
    {editing && <EditSectionDialog key={editing} section={editing} profile={profile} onSave={onChange}
      showSkillValidation={validationAttempted}
      onClose={() => setEditing(null)} onRestoreFocus={() => focusField(returnFocus.current)} />}
  </div>
}
