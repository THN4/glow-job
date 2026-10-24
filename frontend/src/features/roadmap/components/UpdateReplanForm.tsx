import { useId, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FolderGit2, RefreshCw, Sparkles } from 'lucide-react'
import { getSavedProfileId, saveProfile } from '../../resume/api'
import { useSavedProfile } from '../../resume/useSavedProfile'
import { TechnicalSkillsEditor } from '../../onboarding/components/review/TechnicalSkillsEditor'
import { skillLevelSchema, type TechnicalSkill } from '../../onboarding/types'
import { workspaceStyles } from '../../workspace/workspaceStyles'
import { generateRoadmap, updateRoadmapGoal } from '../api'
import { useCareerGoal } from '../useCareerGoal'
import { applyProfileUpdates } from '../profileUpdates'
import { currentRoadmapKey } from '../useCurrentRoadmap'
import { reviewCopy } from '../../../lib/profileConstants'

const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20'

type UpdateReplanFormProps = {
  onClose: () => void
  onWorkingChange: (working: boolean) => void
}

export function UpdateReplanForm({ onClose, onWorkingChange }: UpdateReplanFormProps) {
  const formId = useId()
  const profileQuery = useSavedProfile()
  const goalQuery = useCareerGoal()
  const queryClient = useQueryClient()
  const [skills, setSkills] = useState<TechnicalSkill[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const [working, setWorking] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const profile = profileQuery.data?.profile
  const goal = goalQuery.data

  function changeSkills(next: TechnicalSkill[]) {
    // Reuse saved levels when an existing skill is added to this update.
    setSkills(next.map((skill) => {
      if (skill.level !== null || skills.some((current) => current.name === skill.name)) return skill
      const saved = profile?.technicalSkills.find((item) => item.name?.trim().toLowerCase() === skill.name.toLowerCase())
      const level = skillLevelSchema.safeParse(saved?.proficiency ?? null)
      return { ...skill, level: level.success ? level.data : null }
    }))
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (working || !profile || !goal) return
    setShowValidation(true)
    setError(null)
    const pendingSkill = event.currentTarget.querySelector<HTMLInputElement>(`input[aria-label="${reviewCopy.fields.skill}"]`)
    if (pendingSkill?.value.trim()) {
      setError('Add the skill using + or Enter, then choose its level before saving.')
      pendingSkill.focus()
      return
    }
    if (skills.some((skill) => skill.level === null)) {
      setError('Choose a level for every skill before saving. You can choose Unknown if you are unsure.')
      const missingLevel = [...event.currentTarget.querySelectorAll<HTMLSelectElement>('select[aria-required="true"]')]
        .find((select) => select.value === '')
      missingLevel?.focus()
      return
    }
    const fields = new FormData(event.currentTarget)
    setWorking(true)
    onWorkingChange(true)
    let saved = false
    try {
      const updated = applyProfileUpdates(profile, fields, skills)
      setStage('Saving profile')
      if (JSON.stringify(updated) !== JSON.stringify(profile)) {
        await saveProfile(updated)
        saved = true
      }
      const notes = String(fields.get('notes') ?? '').trim() || null
      if (notes !== goal.additionalContext) {
        await updateRoadmapGoal({
          careerProfileId: goal.careerProfileId, targetRoleTitle: goal.targetRoleTitle,
          readinessTimeframe: goal.readinessTimeframe, targetDate: goal.targetDate,
          weeklyAvailability: goal.weeklyAvailability, availableHoursPerWeek: goal.availableHoursPerWeek,
          preferredLearningStyle: goal.preferredLearningStyle, additionalContext: notes,
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['saved-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['career-goal'] }),
        queryClient.invalidateQueries({ queryKey: ['progress-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['market-career-match'] }),
      ])
      const roadmap = await generateRoadmap(setStage, undefined, true)
      queryClient.setQueryData(currentRoadmapKey(getSavedProfileId()), roadmap)
      await queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
      onClose()
    } catch (caught) {
      void queryClient.invalidateQueries({ queryKey: ['saved-profile'] })
      void queryClient.invalidateQueries({ queryKey: ['career-goal'] })
      void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
      setError(`${saved ? 'Your profile was saved, but re-planning did not finish. ' : ''}${caught instanceof Error ? caught.message : 'Please try again.'}`)
    } finally {
      setWorking(false)
      setStage(null)
      onWorkingChange(false)
    }
  }

  if (!getSavedProfileId()) return <p role="alert" className="text-sm text-slate-600">Save your profile during onboarding before updating and re-planning.</p>
  if (profileQuery.isPending || goalQuery.isPending) return <p role="status" className="text-sm text-slate-600">Loading your saved profile and goal...</p>
  if (profileQuery.isError || goalQuery.isError) return <div role="alert" className="text-sm text-red-700">
    <p>{profileQuery.error?.message ?? goalQuery.error?.message}</p>
    <button type="button" onClick={() => { void profileQuery.refetch(); void goalQuery.refetch() }} className={`mt-3 ${workspaceStyles.outlineAction}`}>Try again</button>
  </div>
  if (!profile || !goal) return <p role="alert" className="text-sm text-slate-600">Save a profile and career goal during onboarding before re-planning.</p>

  const availableSkills = profile.technicalSkills.filter((skill) => skill.name?.trim()
    && !skills.some((item) => item.name.toLowerCase() === skill.name?.trim().toLowerCase()))

  return <form onSubmit={(event) => void submit(event)} aria-label="Update profile and re-plan" className="space-y-5">
    <p className="text-sm leading-6 text-slate-600">Add a project or update your skills to re-plan your path to <strong className="text-foreground">{goal.targetRoleTitle}</strong>.</p>
    <fieldset disabled={working} className="min-w-0 space-y-5 disabled:opacity-60">
      <fieldset className="min-w-0 rounded-xl border border-border p-4 sm:p-5">
        <legend className="flex items-center gap-2 px-2 text-sm font-semibold text-foreground"><FolderGit2 size={18} className="text-primary" aria-hidden="true" />Project</legend>
        <p className="mb-4 text-xs leading-5 text-slate-500">Add a new project, or enter a saved project name to update its details. Optional.</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-foreground">Project name
            <input name="projectName" list={`${formId}-projects`} maxLength={200} placeholder="e.g. Portfolio API" className={inputClass} />
            <datalist id={`${formId}-projects`}>{profile.projects.filter((item) => item.name).map((item) => <option key={item.id} value={item.name ?? ''} />)}</datalist>
          </label>
          <label className="min-w-0 text-sm font-medium text-foreground">Project link
            <input name="projectUrl" type="url" placeholder="https://" className={inputClass} />
          </label>
          <label className="min-w-0 text-sm font-medium text-foreground sm:col-span-2">Project details
            <textarea name="projectDescription" rows={3} placeholder="What did you build, and what did you learn?" className={inputClass} />
          </label>
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4 sm:p-5">
        <legend className="flex items-center gap-2 px-2 text-sm font-semibold text-foreground"><Sparkles size={18} className="text-primary" aria-hidden="true" />Skills learned or updated</legend>
        <p className="text-xs leading-5 text-slate-500">Add each skill and choose its current level. Skills outside this update stay in your profile.</p>
        {availableSkills.length > 0 && <label className="block text-sm font-medium text-foreground">Update an existing skill
          <select value="" onChange={(event) => {
            const saved = availableSkills.find((item) => item.id === event.target.value)
            if (saved?.name) changeSkills([...skills, { name: saved.name.trim(), level: null }])
          }} className={inputClass}>
            <option value="">Choose a skill from your profile</option>
            {availableSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
        </label>}
        <TechnicalSkillsEditor skills={skills} onChange={changeSkills} removable showValidation={showValidation} />
        <label className="block text-sm font-medium text-foreground">How you used these skills <span className="font-normal text-slate-500">(optional)</span>
          <textarea name="evidence" rows={2} placeholder="Describe how you practised or applied the skills above" className={inputClass} />
        </label>
      </fieldset>
      <label className="block text-sm font-medium text-foreground">Re-planning notes <span className="font-normal text-slate-500">(optional)</span>
        <textarea name="notes" defaultValue={goal.additionalContext ?? ''} maxLength={500} rows={2} placeholder="What should your next roadmap focus on?" className={inputClass} />
      </label>
    </fieldset>
    <p className="text-xs leading-5 text-slate-500">The new roadmap replaces the active plan. Earlier versions remain saved.</p>
    {error && <p role="alert" className="text-sm leading-5 text-red-700">{error}</p>}
    {working && <p role="status" className="flex items-center gap-2 text-sm text-primary"><RefreshCw size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{stage ?? 'Preparing'}...</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
      <button type="button" onClick={onClose} disabled={working} className={workspaceStyles.outlineAction}>Cancel</button>
      <button type="submit" disabled={working} className={workspaceStyles.primaryAction}>{working ? 'Saving & re-planning...' : 'Save updates & Re-plan'}</button>
    </div>
  </form>
}
