import { BriefcaseBusiness, Clock3, Code2, Ellipsis, FileText, GraduationCap, Monitor, PlayCircle, Sparkles, Users } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
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
  onAnalyze: () => void
}

export function PreferencesStep({ preferences, onChange, onAnalyze }: PreferencesStepProps) {
  return (
    <div>
      <PageHeader {...onboardingCopy.headers[4]} className="mb-3.5 sm:mb-3.5" />
      <div className="space-y-3">
        <SectionCard icon={Clock3} title={preferencesCopy.hours.title} description={preferencesCopy.hours.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['hoursPerWeek']>
            value={preferences.hoursPerWeek} onChange={(hoursPerWeek) => onChange({ hoursPerWeek })}
            options={preferencesCopy.hours.options} labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
        <SectionCard icon={GraduationCap} color="green" title={preferencesCopy.learning.title} description={preferencesCopy.learning.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['learningStyle']>
            value={preferences.learningStyle} onChange={(learningStyle) => onChange({ learningStyle })}
            options={learningOptions} labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
        <SectionCard icon={BriefcaseBusiness} title={preferencesCopy.situation.title} description={preferencesCopy.situation.description}>
          {({ titleId, descriptionId }) => <SelectGroup<Preferences['situation']>
            value={preferences.situation} onChange={(situation) => onChange({ situation })}
            options={situationOptions} labelledBy={titleId} describedBy={descriptionId}
            className="sm:grid-cols-3 2xl:grid-cols-5" />}
        </SectionCard>
        <SectionCard icon={FileText} color="pink" title={preferencesCopy.notes.title} description={preferencesCopy.notes.description}
          className="min-h-32 xl:grid-cols-[410px_minmax(0,1fr)]">
          {({ titleId, descriptionId }) => <CharCounterTextarea value={preferences.notes} onChange={(notes) => onChange({ notes })}
            labelledBy={titleId} describedBy={descriptionId} placeholder={preferencesCopy.notes.placeholder} />}
        </SectionCard>
      </div>
      <Button type="button" onClick={onAnalyze} className="mt-4 h-13 w-full gap-3 text-sm font-semibold shadow-sm sm:text-base">
        <Sparkles className="size-6" aria-hidden="true" />{preferencesCopy.analyze}
      </Button>
    </div>
  )
}
