import { workspaceStyles } from '../../workspace/workspaceStyles'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { BriefcaseBusiness, Layers3, Target } from 'lucide-react'
import { useState } from 'react'
import { WorkspacePageHeader } from '../../workspace/components/WorkspacePageHeader'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getSavedProfileId, getSessionId, loadCareerMatch, loadCareerProfiles } from '../../resume/api'
import { useCareerGoal } from '../../roadmap/useCareerGoal'

const percent = (value: number | null) => value === null || !Number.isFinite(value) ? 'Unavailable' : `${Math.round(value)}%`

export function MarketInsightsPage() {
  const profileId = getSavedProfileId()
  const sessionId = getSessionId()
  const [selection, setSelection] = useState('')
  const goal = useCareerGoal()
  const careers = useQuery({ queryKey: ['market-career-profiles'], queryFn: loadCareerProfiles, enabled: Boolean(profileId) })
  const savedGoal = goal.data
  const careerProfileId = selection ? Number(selection) : savedGoal?.careerProfileId
  const match = useQuery({
    queryKey: ['market-career-match', sessionId, profileId, careerProfileId],
    queryFn: () => loadCareerMatch(profileId!, careerProfileId!),
    enabled: Boolean(profileId && careerProfileId),
  })
  const data = match.data
  const skills = [...(data?.skills ?? [])].sort((a, b) => (b.demandPercentage ?? 0) - (a.demandPercentage ?? 0))

  const careerProfileSelector = (
        <div className="mt-6 border-b border-slate-100 pb-6">
          <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
            Career profile
            <select value={careerProfileId ?? ''} onChange={(event) => setSelection(event.target.value)} className={workspaceStyles.filter}>
              <option value="" disabled>Select a career profile</option>
              {savedGoal && !careers.data?.some((career) => career.careerProfileId === savedGoal.careerProfileId) && <option value={savedGoal.careerProfileId}>{savedGoal.targetRoleTitle}</option>}
              {careers.data?.map((career) => <option key={career.careerProfileId} value={career.careerProfileId}>{career.profileName}</option>)}
            </select>
          </label>
          {careers.isPending && <p role="status" className="mt-2 text-sm text-slate-500">Loading career profiles…</p>}
          {careers.isError && <p role="alert" className="mt-2 text-sm text-red-700">{careers.error.message} <button type="button" onClick={() => void careers.refetch()} className="underline">Try again</button></p>}
          {goal.isError && <p role="alert" className="mt-2 text-sm text-red-700">Could not load your saved goal. Select a career profile above. <button type="button" onClick={() => void goal.refetch()} className="underline">Retry goal</button></p>}
          {!careers.isPending && !careers.isError && !careers.data?.length && !savedGoal && <p className="mt-2 text-sm text-slate-600">No career profiles with market statistics are available yet.</p>}
        </div>
  )

  return (
    <section aria-label="Market insights" className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-4">
      <WorkspacePageHeader
        title="Market Insights"
        description="Explore skills from collected job postings and compare them with your saved profile."
      />
      {!profileId ? <p>Save your profile during <Link to="/onboarding" className="text-blue-700 underline">onboarding</Link> to view market insights.</p> : <>
        {data && <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p>{data.marketWindow ? `Posting window: ${data.marketWindow.startDate} – ${data.marketWindow.endDate}` : 'No market posting window is available.'}</p>
            <p className="mt-1">{data.marketSample.lastUpdated ? `Last updated: ${new Date(data.marketSample.lastUpdated).toLocaleString()}` : 'Last update unavailable.'}</p>
            {data.warnings.length > 0 && <ul className="mt-2 list-inside list-disc">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          </div>
          <StatGrid columns={3} label="Market statistics">
            {[
              { icon: BriefcaseBusiness, label: 'Job postings', value: data.marketSample.totalJobs, detail: 'Collected for the selected career profile' },
              { icon: Layers3, label: 'Skills analysed', value: skills.length, detail: 'Skills returned by the market comparison' },
              { icon: Target, label: 'Core skill match', value: percent(data.scores.coreSkillMatchPct), detail: `${data.skillSummary.coreCovered} of ${data.skillSummary.coreConsidered} core skills covered in your profile` },
            ].map(({ label, value, detail, icon }) => <StatCard key={label} label={label} value={value} detail={detail} icon={icon} />)}
          </StatGrid>
        </>}
          <section className="my-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className={workspaceStyles.sectionTitle}>Skill frequency in job postings</h2>
            <p className="mt-1 text-xs text-slate-500">Top 10 skills by share of collected postings for the selected career profile.</p>
            {careerProfileSelector}
            {!careerProfileId && <p className="mt-4 text-sm text-slate-600">Choose a career profile to view its market data.</p>}
            {careerProfileId && match.isPending && <p role="status" className="mt-4 text-sm text-slate-600">Loading market insights…</p>}
            {match.isError && <p role="alert" className="mt-4 text-sm text-red-700">{match.error.message} <button type="button" onClick={() => void match.refetch()} className="underline">Try again</button></p>}
            {data && (data.marketSample.totalJobs === 0 || !skills.length ? <p className="mt-4 text-sm text-slate-600">No skill frequency data is available for this career profile yet.</p> : <div className="mt-8 space-y-7 pb-2">
              {skills.slice(0, 10).map((skill) => {
                const available = Number.isFinite(skill.demandPercentage)
                const value = available ? Math.max(0, Math.min(100, skill.demandPercentage)) : 0
                const barColor = `hsl(217 85% ${75 - value * 0.35}%)`
                return <div key={skill.skillId} className="grid grid-cols-[5rem_minmax(0,1fr)_3rem] items-center gap-x-2 sm:grid-cols-[9rem_minmax(0,1fr)_4rem] sm:gap-x-3">
                  <span className="min-w-0 break-words text-sm font-semibold text-slate-800">{skill.skillName}</span>
                  {available ? <div role="meter" aria-label={`${skill.skillName} demand`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="flex h-3 w-full justify-start overflow-hidden rounded-full bg-slate-100"><div className="h-full shrink-0 rounded-full" style={{ width: `${value}%`, backgroundColor: barColor }} /></div> : <span className="text-xs text-slate-500">No data</span>}
                  <span className="text-right text-sm font-bold text-slate-900">{percent(skill.demandPercentage)}</span>
                </div>
              })}
            </div>)}
          </section>
      </>}
    </section>
  )
}
