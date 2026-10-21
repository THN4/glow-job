import { BriefcaseBusiness, Clock3, Code2, Ellipsis, FileText, GraduationCap, Monitor, PlayCircle, Users } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { preferencesCopy } from '../../../../lib/preferencesConstants'
import { CharCounterTextarea } from '../../components/CharCounterTextarea'
import { PageHeader } from '../../components/layout/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { SelectGroup } from '../../components/SelectGroup'
import type { Preferences } from '../../types'

const learningIcons = { courses: Monitor, projects: Code2, reading: FileText, videos: PlayCircle }
const situationIcons = { student: GraduationCap, full_time: BriefcaseBusiness, part_time: Clock3, between_opportunities: Users, other: Ellipsis }
const learningOptions = preferencesCopy.learning.options.map((option) => ({ ...option,
  icon: learningIcons[option.value], iconClassName: option.value === 'projects' ? 'text-info' : undefined }))
const situationOptions = preferencesCopy.situation.options.map((option) => ({ ...option, icon: situationIcons[option.value] }))

type PreferencesStepProps = {
  preferences: Preferences
  onChange: (updates: Partial<Preferences>) => void
}

export function PreferencesStep({ preferences, onChange }: PreferencesStepProps) {
  return (
    <div>
      <PageHeader {...onboardingCopy.headers[4]} />
      <div className="space-y-4">
        <SectionCard layout="stacked" icon={Clock3} title={preferencesCopy.hours.title} description={preferencesCopy.hours.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['hoursPerWeek']>
            value={preferences.hoursPerWeek} onChange={(hoursPerWeek) => onChange({ hoursPerWeek })}
            options={preferencesCopy.hours.options} labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
        <SectionCard layout="stacked" icon={GraduationCap} color="green" title={preferencesCopy.learning.title} description={preferencesCopy.learning.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['learningStyle']>
            value={preferences.learningStyle} onChange={(learningStyle) => onChange({ learningStyle })}
            options={learningOptions} labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
        <SectionCard layout="stacked" icon={BriefcaseBusiness} title={preferencesCopy.situation.title} description={preferencesCopy.situation.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['situation']>
            value={preferences.situation} onChange={(situation) => onChange({ situation })}
            options={situationOptions} labelledBy={titleId} describedBy={descriptionId}
            className="sm:grid-cols-3 2xl:grid-cols-5" />}
        </SectionCard>
        <SectionCard layout="stacked" icon={FileText} color="pink" title={preferencesCopy.notes.title} description={preferencesCopy.notes.description}>
          {({ titleId, descriptionId }) => <CharCounterTextarea value={preferences.notes} onChange={(notes) => onChange({ notes })}
            labelledBy={titleId} describedBy={descriptionId} placeholder={preferencesCopy.notes.placeholder} />}
        </SectionCard>
      </div>
    </div>
  )
}
