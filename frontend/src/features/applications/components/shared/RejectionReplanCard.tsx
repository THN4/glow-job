import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getSavedProfileId } from '../../../resume/api'
import { currentRoadmapKey } from '../../../roadmap/useCurrentRoadmap'
import { generateRoadmap, loadRejectionReplanOptions, type RejectionReplanOptions } from '../../../roadmap/api'
import type { RoadmapJob } from '../../../roadmap/api-types'

export function RejectionReplanCard({ applicationId }: { applicationId: string }) {
  const [preview, setPreview] = useState<RejectionReplanOptions | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [working, setWorking] = useState(false)
  const [stage, setStage] = useState<RoadmapJob['stage'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function openPreview() {
    setWorking(true)
    setError(null)
    try {
      setPreview(await loadRejectionReplanOptions(applicationId))
      setSelected([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not review this application.')
    } finally {
      setWorking(false)
    }
  }

  function toggle(skillId: number) {
    setSelected((current) => current.includes(skillId)
      ? current.filter((id) => id !== skillId)
      : current.length < 3 ? [...current, skillId] : current)
  }

  async function confirm() {
    if (!preview || !selected.length || working) return
    setWorking(true)
    setError(null)
    try {
      const roadmap = await generateRoadmap(setStage, undefined, false, {
        applicationId: preview.applicationId, focusSkillIds: selected,
      })
      queryClient.setQueryData(currentRoadmapKey(getSavedProfileId()), roadmap)
      await queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['roadmap-history'] })
      navigate('/app/roadmap')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a revised roadmap.')
    } finally {
      setWorking(false)
      setStage(null)
    }
  }

  return <section aria-label="Re-plan after rejection" className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm sm:p-5">
    <h3 className="text-base font-bold text-slate-900">Consider updating your roadmap</h3>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">
      You recorded a skill-gap rejection. Review the skills named in your feedback and choose which to revisit. This does not prove why the employer made its decision.
    </p>
    {!preview && <button type="button" onClick={() => void openPreview()} disabled={working}
      className="mt-3 min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-60">
      {working ? 'Reviewing…' : 'Review skills for re-plan'}
    </button>}
    {preview && <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">For <strong>{preview.role}</strong> · {preview.options.length
        ? preview.matchingMode === 'feedback_mentions'
          ? 'Skills found in your saved reason. Select up to three to learn or review again.'
          : 'No reason was saved. These are general market gaps; choose only those you want to focus on.'
        : preview.matchingMode === 'feedback_mentions'
          ? 'A skill was named, but it has no eligible learning option for this career goal.'
          : preview.matchingMode === 'no_mentions'
            ? 'No catalog skill name was found in this reason. Edit the saved reason to name the skill you want to review.'
          : 'No eligible skill gaps were found for this application and career goal.'}</p>
      {preview.rejectionReason && <p className="rounded-lg bg-white p-2 text-xs text-slate-600">
        Your saved reason: {preview.rejectionReason}</p>}
      <div className="space-y-2">
        {preview.options.map((option) => <label key={option.skillId}
          className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${option.learningContentAvailable ? 'border-blue-100 bg-white' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
          <input type="checkbox" checked={selected.includes(option.skillId)}
            disabled={working || !option.learningContentAvailable || (selected.length >= 3 && !selected.includes(option.skillId))}
            onChange={() => toggle(option.skillId)} className="mt-0.5" />
          <span><strong>{option.name}</strong> · {option.source === 'feedback_mention'
            ? 'named in your feedback' : option.source === 'job_requirement'
              ? `${option.requirementType} in saved posting` : 'career market gap'}
            {option.completedInRoadmap ? ' · completed before; review again'
              : option.alreadyCompleted ? ' · in your profile; review again'
              : option.alreadyPlanned ? ' · already in your roadmap' : ''}
            {!option.learningContentAvailable && ' · learning content not ready'}</span>
        </label>)}
      </div>
      <p className="text-xs text-slate-500">Selected skills start fresh in the revised plan, even if completed before. The previous completion remains in the old version. Your profile and match score are unchanged.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void confirm()} disabled={working || !selected.length}
          className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-60">
          {working ? `Creating roadmap: ${stage ?? 'preparing'}…` : 'Create revised roadmap'}
        </button>
        <button type="button" onClick={() => { setPreview(null); setSelected([]); setError(null) }} disabled={working}
          className="min-h-9 rounded-lg border border-blue-200 bg-white px-4 text-xs font-semibold text-blue-700 disabled:opacity-60">Keep current plan</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
  </section>
}
