import { useState } from 'react'
import { ArrowRight, Building2, CheckCircle2, MapPin, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CompanyOpening, JobFilters, JobRecommendation, JobRecommendationsResponse } from '../../type'
import { JobRecommendationsToolbar } from './JobRecommendationsToolbar'
import type { RoadmapNodeData } from '../../../roadmap/type'
import { CompanyOpeningDetail } from '../companies/CompanyOpeningDetail'
import { companyAvatarColor } from '../shared/companyAvatar'

type JobsForYouTabProps = {
  filters: JobFilters
  onFiltersChange: (filters: JobFilters) => void
  data?: JobRecommendationsResponse
  isLoading: boolean
  error: string | null
  isRefreshing: boolean
  onRetry: () => void
  applications: { jobId?: string | null }[]
  onAddOpening: (opening: CompanyOpening) => Promise<void>
  isSaving: boolean
  saveError: string | null
  roadmapNodes: RoadmapNodeData[]
}

function SkillList({ label, skills }: { label: string; skills: string[] }) {
  return <div className="mt-3"><h4 className="text-xs font-semibold text-slate-800">{label}</h4>
    <p className="mt-1 text-xs leading-5 text-slate-600">{skills.length ? skills.join(' · ') : 'None'}</p>
  </div>
}

function MatchFacts({ job }: { job: JobRecommendation }) {
  const matchedSkills = job.requiredMatches.length + job.preferredMatches.length
  const totalSkills = matchedSkills + job.requiredMissing.length + job.preferredMissing.length
  const score = Math.max(0, Math.min(100, job.scorePct))
  return <>
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white p-3">
      <div className="relative flex size-[76px] shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <svg viewBox="0 0 76 76" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <circle cx="38" cy="38" r="31" fill="none" stroke="#d1fae5" strokeWidth="5" />
          <circle cx="38" cy="38" r="31" fill="none" stroke="#059669" strokeWidth="5" pathLength="100" strokeDasharray={`${score} 100`} strokeLinecap={score > 0 ? 'round' : 'butt'} />
        </svg>
        <span className="relative text-lg font-extrabold tracking-tight text-emerald-700 tabular-nums">{job.scorePct}<span className="ml-0.5 text-[11px] font-bold">%</span></span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-950">Skill coverage</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{matchedSkills} of {totalSkills} scored skills matched</p>
        {job.matchesGoal && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"><Target className="size-3" aria-hidden="true" />Target career</span>}
      </div>
    </div>
    {!job.requiredMatches.length && !job.requiredMissing.length && <p className="mt-2 text-xs text-amber-800">Scored on preferred skills only; no required skills were classified.</p>}
    <SkillList label="Required skills in your profile" skills={job.requiredMatches} />
    <SkillList label="Required skills to review" skills={job.requiredMissing} />
    <SkillList label="Preferred skills in your profile" skills={job.preferredMatches} />
  </>
}

export function JobsForYouTab({ data, filters, onFiltersChange, isLoading, error, isRefreshing, onRetry, applications, onAddOpening, isSaving, saveError, roadmapNodes }: JobsForYouTabProps) {
  const [selected, setSelected] = useState<JobRecommendation | null>(null)
  const saved = (jobId: number) => applications.some((application) => application.jobId === String(jobId))
  const [localError, setLocalError] = useState<string | null>(null)

  async function addJob(job: CompanyOpening) {
    setLocalError(null)
    try { await onAddOpening(job) }
    catch (caught) { setLocalError(caught instanceof Error ? caught.message : 'Could not save this posting. Try again.') }
  }

  if (isLoading) return <p role="status" className="rounded-xl border border-blue-100 bg-white p-8 text-center text-sm text-slate-600">Matching your profile with job postings…</p>
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-white p-6">
    <p className="text-sm text-red-700">{error}</p>
    <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">Try again</button>
  </div>
  if (!data) return null

  return <section aria-label="Jobs for you" className="space-y-4">
    {(saveError || localError) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError || localError}</p>}
    {selected ? <>
      <article className="rounded-xl border border-blue-100 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">{selected.role}</h2>
        <p className="mt-1 text-sm text-slate-600">{selected.company} · {selected.location}</p>
        <MatchFacts job={selected} />
        <SkillList label="Preferred skills to review" skills={selected.preferredMissing} />
        <SkillList label="Other extracted skills (not scored)" skills={selected.unscoredSkills} />
        <ul className="mt-4 list-inside list-disc text-xs leading-6 text-slate-600">{selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <p className="mt-2 text-xs text-slate-500">{selected.matchedWeight} of {selected.totalWeight} weighted skill points. Skill presence does not assess proficiency or predict hiring.</p>
      </article>
      <CompanyOpeningDetail key={selected.jobId} opening={selected} alreadySaved={saved(selected.jobId)}
        onAddToApplications={() => onAddOpening(selected)} onBack={() => setSelected(null)}
        backLabel="Back to Jobs for you" roadmapNodes={roadmapNodes} canSave isSaving={isSaving} />
    </> : <>
      <JobRecommendationsToolbar data={data} filters={filters} isRefreshing={isRefreshing} onRefresh={onRetry} onChange={onFiltersChange} />
      {!data.recommendations.length ? <div className="rounded-xl border border-dashed border-blue-200 bg-white p-8 text-center">
        <h3 className="font-semibold text-slate-900">{data.totalMatched > 0 ? 'No jobs match these filters' : !data.totalCandidates ? 'No job postings are available yet' : !data.hasConfirmedSkills ? 'Confirm your skills to find matching jobs' : data.unscoredPostings === data.totalCandidates ? 'Job skill requirements are not ready to score yet' : 'No scored skill matches were found'}</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{data.totalMatched > 0 ? 'Try another location, employment type, or skill, or clear your filters to see all matches.' : 'Matches need at least one confirmed skill in common with a posting’s required or preferred skills. Review your profile or explore other openings.'}</p>
        <p className="mt-2 text-xs text-slate-500">{data.totalCandidates} postings checked; {data.unscoredPostings} have no classified required or preferred skills.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm font-semibold text-blue-700"><Link to="/app/skill-profile">Review Skill Profile</Link><Link to="/app/applications?tab=companies">Browse Companies</Link></div>
      </div> : <>
        <div aria-busy={isRefreshing} className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isRefreshing ? 'opacity-60' : ''}`}>
          {data.recommendations.map((job) => <article key={job.jobId} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${companyAvatarColor(job.company)}`}><Building2 className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0"><h3 className="text-sm font-bold text-slate-900">{job.role}</h3><p className="mt-1 text-xs text-slate-600">{job.company}</p></div>
            </div>
            <p className="mt-3 flex items-start gap-1 text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />{job.location} · {job.experience}</p>
            <MatchFacts job={job} />
            <p className="mt-3 text-xs leading-5 text-slate-500">{job.reasons[0]}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <button type="button" disabled={isRefreshing} onClick={() => { setSelected(job); setLocalError(null) }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 disabled:opacity-50">View job <ArrowRight className="size-3" aria-hidden="true" /></button>
              <button type="button" onClick={() => addJob(job)} disabled={saved(job.jobId) || isSaving || isRefreshing} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:bg-slate-100 disabled:text-slate-500">{saved(job.jobId) ? <><CheckCircle2 className="size-3" aria-hidden="true" />Saved</> : isSaving ? 'Saving…' : 'Save to My Applications'}</button>
            </div>
          </article>)}
        </div>
      </>}
    </>}
  </section>
}
