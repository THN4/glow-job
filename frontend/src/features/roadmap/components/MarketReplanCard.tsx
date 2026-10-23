import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSavedProfileId } from '../../resume/api'
import { currentRoadmapKey } from '../useCurrentRoadmap'
import { generateRoadmap, loadMarketReplanOptions, type MarketReplanOptions } from '../api'
import type { RoadmapJob } from '../api-types'

export function MarketReplanCard() {
  const [preview, setPreview] = useState<MarketReplanOptions | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [working, setWorking] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [stage, setStage] = useState<RoadmapJob['stage'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    let active = true
    setWorking(true)
    setError(null)
    void loadMarketReplanOptions().then((result) => {
      if (!active) return
      setPreview(result)
      const requestedSkillId = Number(searchParams.get('skillId'))
      const suggested = result.options.find((option) => option.skillId === requestedSkillId)
        ?? result.options[0]
      setSelected(suggested ? [suggested.skillId] : [])
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Could not load market skills.')
    }).finally(() => {
      if (active) setWorking(false)
    })
    return () => { active = false }
  }, [searchParams, refresh])

  async function confirm() {
    if (!selected.length || working) return
    setWorking(true)
    setError(null)
    try {
      const roadmap = await generateRoadmap(setStage, undefined, false, { marketFocusSkillIds: selected })
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

  return <section aria-label="Market-based roadmap update"
    className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm sm:p-5">
    <h2 className="text-base font-bold text-slate-900">A skill to consider for your roadmap</h2>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">
      This demo alert tells a market story using a real skill and saved posting counts. It does not claim demand is increasing. Choose whether to add one skill to a new roadmap version.
    </p>
    {!preview && !error && <p role="status" className="mt-3 text-xs text-slate-600">Loading a suggested skill…</p>}
    {preview && <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">
        <strong>{preview.careerName}</strong>
        {preview.marketWindow && <> · snapshot {preview.marketWindow.analysisStartDate} to {preview.marketWindow.analysisEndDate}</>}
      </p>
      <p className="rounded-lg border border-amber-200 bg-white/70 p-2 text-xs text-amber-900">{preview.notice}</p>
      {!preview.options.length && <p className="text-xs text-slate-600">No additional skills are available in this saved market snapshot.</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {preview.options.map((option) => <label key={option.skillId}
          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs ${selected.includes(option.skillId) ? 'border-blue-300 bg-blue-50' : 'border-blue-100 bg-white'}`}>
          <input type="radio" name="market-skill" checked={selected.includes(option.skillId)}
            disabled={working} onChange={() => setSelected([option.skillId])} className="mt-0.5" />
          <span className="space-y-1"><strong className="block text-sm text-slate-900">{option.name}</strong>
            <span className="block leading-relaxed text-slate-700">{option.alertDetail}</span>
            <span className="block text-slate-500">{option.demandCount} of {option.totalJobs} postings · {option.demandPercentage.toFixed(1)}% · {option.gapStatus.replace(/_/g, ' ')}</span>
            {!option.learningContentAvailable && <span className="block text-amber-700">Learning content is not ready yet. The skill will appear as a placeholder node.</span>}
          </span>
        </label>)}
      </div>
      <p className="text-xs text-slate-500">Choosing a skill creates a new roadmap version by extending your existing Agent Context. Your saved profile and match score stay the same.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void confirm()} disabled={working || !selected.length}
          className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-60">
          {working ? `Creating roadmap: ${stage ?? 'preparing'}…` : 'Add this skill and replan'}
        </button>
        <button type="button" onClick={() => navigate('/app/roadmap')} disabled={working}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 disabled:opacity-60">
          Keep current roadmap
        </button>
      </div>
    </div>}
    {error && <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">
      <p role="alert">{error}</p>
      <button type="button" onClick={() => setRefresh((current) => current + 1)} className="mt-1 font-semibold underline">Try again</button>
    </div>}
  </section>
}
