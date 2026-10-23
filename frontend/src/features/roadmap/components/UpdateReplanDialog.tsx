import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { getSavedProfileId, saveProfile } from '../../resume/api'
import { useSavedProfile } from '../../resume/useSavedProfile'
import { generateRoadmap, updateRoadmapGoal } from '../api'
import { useCareerGoal } from '../useCareerGoal'
import { applyProfileUpdates } from '../profileUpdates'
import { currentRoadmapKey } from '../useCurrentRoadmap'

const inputClass = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm'

export function UpdateReplanDialog({ onClose }: { onClose: () => void }) {
  const profileQuery = useSavedProfile()
  const goalQuery = useCareerGoal()
  const queryClient = useQueryClient()
  const [working, setWorking] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const profile = profileQuery.data?.profile
  const goal = goalQuery.data

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (working || !profile || !goal) return
    const fields = new FormData(event.currentTarget)
    setWorking(true)
    setError(null)
    let saved = false
    try {
      const updated = applyProfileUpdates(profile, fields)
      setStage('saving profile')
      if (JSON.stringify(updated) !== JSON.stringify(profile)) await saveProfile(updated)
      saved = true
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
      if (saved) {
        void queryClient.invalidateQueries({ queryKey: ['saved-profile'] })
        void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
      }
      setError(`${saved ? 'Your profile was saved, but re-planning did not finish. ' : ''}${caught instanceof Error ? caught.message : 'Please try again.'}`)
    } finally {
      setWorking(false)
      setStage(null)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !working) onClose() }}>
    <DialogContent showCloseButton={!working} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogTitle className="pr-8 text-lg font-bold">Update Profile &amp; Re-plan</DialogTitle>
      <DialogDescription>Update your saved profile and add what you have learned. We will use your updates and saved career goal to create a new roadmap.</DialogDescription>
      {(profileQuery.isPending || goalQuery.isPending) && <p role="status">Loading your saved profile and goal…</p>}
      {(profileQuery.isError || goalQuery.isError) && <div role="alert" className="text-red-700"><p>{profileQuery.error?.message ?? goalQuery.error?.message}</p><button type="button" onClick={() => { void profileQuery.refetch(); void goalQuery.refetch() }} className="mt-2 underline">Try again</button></div>}
      {profile && goal && <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <fieldset disabled={working} className="space-y-4 disabled:opacity-60">
          <p className="text-sm text-slate-600">Career goal: <strong>{goal.targetRoleTitle}</strong></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Full name<input name="fullName" defaultValue={profile.personal.fullName ?? ''} className={inputClass} /></label>
            <label className="text-sm font-medium">Headline<input name="headline" defaultValue={profile.personal.headline ?? ''} className={inputClass} /></label>
          </div>
          <label className="block text-sm font-medium">Profile summary<textarea name="summary" defaultValue={profile.summary ?? ''} rows={3} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className="text-sm font-medium">Skills learned or updated<input name="skills" placeholder="Enter skill names, separated by commas" className={inputClass} /><span className="text-xs font-normal text-slate-500">Existing skills are kept. Matching skills will be updated.</span></label>
            <label className="text-sm font-medium">Skill level<select name="skillLevel" defaultValue="unknown" className={inputClass}><option value="unknown">Keep existing / unspecified</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select></label>
          </div>
          <label className="block text-sm font-medium">Evidence for these skills<textarea name="evidence" rows={2} placeholder="Describe how you used the skills listed above" className={inputClass} /></label>
          <label className="block text-sm font-medium">Project name<input name="projectName" placeholder="Add a project, or enter an existing project name to update it" className={inputClass} /></label>
          <label className="block text-sm font-medium">Project details<textarea name="projectDescription" rows={2} className={inputClass} /></label>
          <label className="block text-sm font-medium">Project link<input name="projectUrl" type="url" placeholder="https://" className={inputClass} /></label>
          <label className="block text-sm font-medium">Re-planning notes<textarea name="notes" defaultValue={goal.additionalContext ?? ''} maxLength={500} rows={3} placeholder="Tell us what changed or what to focus on" className={inputClass} /></label>
        </fieldset>
        <p className="text-xs text-slate-500">The new roadmap replaces the active plan. Earlier versions remain saved.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {working && <p role="status" className="text-sm text-blue-700">{stage ?? 'Preparing'}…</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={working} className="min-h-10 rounded-lg border px-4 text-sm disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={working} className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{working ? 'Saving & re-planning…' : 'Save updates & Re-plan'}</button>
        </div>
      </form>}
      {!goalQuery.isPending && !goalQuery.isError && !goal && <p role="alert">Save a career goal during onboarding before re-planning.</p>}
    </DialogContent>
  </Dialog>
}
