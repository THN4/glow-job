import { useRef, useState, type MouseEvent } from 'react'
import { ArrowLeft, ArrowRight, Award, BriefcaseBusiness, CircleAlert, CircleCheck, Code2, GraduationCap, NotebookText, Sparkles } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { SkillChip } from '../../../../components/shared/SkillChip'
import { StatusTag } from '../../../../components/shared/StatusTag'
import { onboardingCopy } from '../../../../lib/constants'
import { reviewCopy } from '../../../../lib/profileConstants'
import { PageHeader } from '../../components/layout/PageHeader'
import { EditSectionDialog } from '../../components/review/EditSectionDialog'
import { InfoCard } from '../../components/review/InfoCard'
import { SkillInput } from '../../components/review/SkillInput'
import type { Profile, ProfileSection } from '../../types'

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
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  function openEditor(section: ProfileSection | 'all', event: MouseEvent<HTMLButtonElement>) {
    returnFocus.current = event.currentTarget
    setEditing(section)
  }
  return <div>
    <PageHeader {...(source === 'cv' ? onboardingCopy.headers[2] : reviewCopy.manualHeader)} className="mb-3.5 sm:mb-3.5"
      badge={source === 'cv' ? <StatusTag icon={Sparkles} variant="info">{reviewCopy.autofilled}</StatusTag> : undefined} />
    <div className="grid gap-4 xl:grid-cols-2">
      <InfoCard title={reviewCopy.titles.education} icon={GraduationCap} color="green" className="xl:min-h-44"
        onEdit={(event) => openEditor('education', event)}>
        <div className="space-y-1 px-1">
          {profile.education ? <>
            <h3 className="break-words text-xl font-semibold leading-6">{profile.education.degree}</h3>
            <p className="break-words text-base leading-5 text-muted-foreground">{profile.education.school}</p>
            {profile.education.period && <p className="text-base leading-5 text-muted-foreground">{profile.education.period}</p>}
            <StatusTag variant={profile.education.confirmed ? 'success' : 'warning'} icon={profile.education.confirmed ? CircleCheck : CircleAlert}>
              {profile.education.confirmed ? reviewCopy.confirmedEducation : reviewCopy.confirmEducation}
            </StatusTag>
          </> : <p className="py-3 text-muted-foreground">{reviewCopy.empty.education}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.skills} icon={Code2} color="purple" className="xl:min-h-44"
        onEdit={(event) => openEditor('skills', event)}>
        <div className="space-y-2 px-1">
          {profile.skills.length ? <SkillChips skills={profile.skills} /> : <p className="text-muted-foreground">{reviewCopy.empty.skills}</p>}
          <SkillInput skills={profile.skills} onChange={(skills) => onChange({ skills })} />
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.projects} icon={NotebookText} color="pink" className="xl:min-h-49"
        onEdit={(event) => openEditor('projects', event)}>
        <div className="space-y-4 px-1">
          {profile.projects.length ? profile.projects.map((project, index) => <article key={index} className="space-y-2">
            <h3 className="break-words text-xl font-semibold leading-6">{project.name}</h3>
            {project.description && <p className="break-words text-base leading-5 text-muted-foreground">{project.description}</p>}
            <SkillChips skills={project.skills} />
          </article>) : <p className="py-3 text-muted-foreground">{reviewCopy.empty.projects}</p>}
        </div>
      </InfoCard>
      <InfoCard title={reviewCopy.titles.experience} icon={BriefcaseBusiness} color="blue" className="xl:min-h-49"
        onEdit={(event) => openEditor('experience', event)}>
        <div className="space-y-4 px-1">
          {profile.experience.length ? profile.experience.map((experience, index) => <article key={index} className="space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-lg font-semibold leading-6">{experience.role}</h3>
              {experience.period && <span className="text-sm leading-6 text-muted-foreground">{experience.period}</span>}
            </div>
            <p className="break-words text-base leading-5 text-muted-foreground">{experience.company}</p>
            {experience.description && <p className="break-words text-base leading-5 text-muted-foreground">{experience.description}</p>}
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
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      <Button type="button" variant="ghost" onClick={onBack} className="h-13 gap-2 text-primary sm:mr-auto">
        <ArrowLeft className="size-4" aria-hidden="true" />{onboardingCopy.back}
      </Button>
      <Button type="button" variant="outline" onClick={(event) => openEditor('all', event)} className="h-13 flex-1 border-input bg-card px-6 text-lg text-primary sm:flex-none sm:min-w-54">
        {reviewCopy.editProfile}
      </Button>
      <Button type="button" onClick={onContinue} className="h-13 w-full gap-3 px-6 text-lg font-semibold sm:w-auto sm:min-w-75 sm:mr-auto">
        {reviewCopy.continue}<ArrowRight className="size-5" aria-hidden="true" />
      </Button>
    </div>
    {editing && <EditSectionDialog key={editing} section={editing} profile={profile} onSave={onChange}
      onClose={() => setEditing(null)} onRestoreFocus={() => returnFocus.current?.focus()} />}
  </div>
}
