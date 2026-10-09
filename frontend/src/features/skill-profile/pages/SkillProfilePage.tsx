import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Clock3 } from 'lucide-react'
import { CompletedSkillsSection } from '../components/CompletedSkillsSection'
import { InProgressSkillCard } from '../components/InProgressSkillCard'
import { SkillProfileHeader } from '../components/SkillProfileHeader'
import { SkillProfileStats } from '../components/SkillProfileStats'
import { UpcomingSkillCard } from '../components/UpcomingSkillCard'
import { skillProfileMockData } from '../data/skillProfileMockData'
import type { SkillChecklistItem, SkillEvidenceSource } from '../type'

export function SkillProfilePage() {
  const profile = skillProfileMockData
  const [checklist, setChecklist] = useState<SkillChecklistItem[]>(
    profile.inProgressSkill.checklist ?? [],
  )
  const [completedInProgressSkill, setCompletedInProgressSkill] = useState(false)
  const [learningStarted, setLearningStarted] = useState(false)
  const [evidenceBySkill, setEvidenceBySkill] = useState<Record<string, SkillEvidenceSource[]>>({})
  const [inProgressEvidence, setInProgressEvidence] = useState<SkillEvidenceSource[]>([])
  const [upcomingEvidence, setUpcomingEvidence] = useState<SkillEvidenceSource[]>([])

  const completedSkills = completedInProgressSkill
    ? [...profile.completedSkills, profile.inProgressSkill]
    : profile.completedSkills

  function addDefaultEvidence(skillId: string) {
    setEvidenceBySkill((current) => ({
      ...current,
      [skillId]: current[skillId]?.length ? [] : ['GitHub project'],
    }))
  }

  function toggleChecklist(itemId: string) {
    setChecklist((current) => current.map((item) => (
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )))
  }

  function toggleEvidence(
    setCurrent: Dispatch<SetStateAction<SkillEvidenceSource[]>>,
    source: SkillEvidenceSource,
  ) {
    setCurrent((current) => current.includes(source)
      ? current.filter((item) => item !== source)
      : [...current, source])
  }

  return (
    <section aria-label="Skill profile" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4 [@media(max-height:960px)]:gap-3">
      <SkillProfileHeader targetRole={profile.targetRole} duration={profile.duration} />

      <SkillProfileStats
        total={5}
        completed={completedSkills.length}
        inProgress={completedInProgressSkill ? 0 : 1}
        upcoming={1}
      />

      <CompletedSkillsSection
        skills={completedSkills}
        evidenceBySkill={evidenceBySkill}
        onAddEvidence={addDefaultEvidence}
      />

      <div className={`grid gap-5 [@media(max-height:960px)]:gap-3 ${completedInProgressSkill ? 'grid-cols-1' : 'md:grid-cols-[1.65fr_0.9fr]'}`}>
        {!completedInProgressSkill && (
          <section aria-labelledby="in-progress-heading">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 id="in-progress-heading" className="flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-blue-600 text-blue-600">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                </span>
                In progress
              </h2>
              <p className="text-xs text-slate-500">Skills you’re currently learning.</p>
            </div>
            <InProgressSkillCard
              skill={profile.inProgressSkill}
              checklist={checklist}
              evidence={inProgressEvidence}
              started={learningStarted}
              onToggleChecklist={toggleChecklist}
              onToggleEvidence={(source) => toggleEvidence(setInProgressEvidence, source)}
              onStart={() => setLearningStarted(true)}
              onMarkCompleted={() => setCompletedInProgressSkill(true)}
            />
          </section>
        )}

        <section aria-labelledby="up-next-heading">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="up-next-heading" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Clock3 size={17} className="text-slate-500" aria-hidden="true" />
              Up next
            </h2>
            <p className="text-xs text-slate-500">Next on your roadmap.</p>
          </div>
          <UpcomingSkillCard
            skill={profile.upcomingSkill}
            evidence={upcomingEvidence}
            onToggleEvidence={(source) => toggleEvidence(setUpcomingEvidence, source)}
          />
        </section>
      </div>
    </section>
  )
}
