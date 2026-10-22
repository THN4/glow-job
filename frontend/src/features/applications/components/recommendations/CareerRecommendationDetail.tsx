import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Layers3, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CareerPathRecommendation } from '../../type'
import type { RoadmapNodeData } from '../../../roadmap/type'
import { roadmapSummary } from '../../../roadmap/data/roadmapMockData'
import { CareerPathIcon } from './CareerPathIcon'

type CareerRecommendationDetailProps = {
  path: CareerPathRecommendation
  roadmapNodes: RoadmapNodeData[]
  onBack: () => void
}

const relatedNodeId: Record<string, string> = {
  'etl foundations': 'etl-pipelines',
  'data transformation': 'etl-pipelines',
}

export function CareerRecommendationDetail({ path, roadmapNodes, onBack }: CareerRecommendationDetailProps) {
  const [secondaryGoal, setSecondaryGoal] = useState(false)
  const developingSkills = roadmapNodes.filter((node) => node.kind === 'skill' && node.status !== 'completed')

  return (
    <section aria-label={`${path.title} career path details`} className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft size={14} aria-hidden="true" />Back to Recommendations</button>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><CareerPathIcon pathId={path.id} size={16} /></span>Why this path is worth exploring</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{path.whyExplore}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Typical work: {path.developmentAreas.slice(0, 3).join(', ')} and collaborate with analysts on trustworthy metrics.</p>
      </article>

      <div className="grid items-start gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Layers3 size={14} aria-hidden="true" /></span>Supported by your profile</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {path.supportedProfile.map((item) => (
              (() => {
                const key = item.skill.toLowerCase()
                const node = roadmapNodes.find((entry) => entry.id === (relatedNodeId[key] ?? key))
                const statusLabel = node?.status === 'completed' ? 'Completed' : node?.status === 'in-progress' ? 'In progress' : node?.status === 'upcoming' ? 'Up next' : 'Related'
                const statusClass = node?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : node?.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                return (
              <section key={item.skill} className="py-2 first:pt-0 last:pb-0">
                <h3 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-800"><CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />{item.skill}<span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusClass}`}>{statusLabel}</span></h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
                <Link to="/app/skill-profile" className="mt-1 inline-block text-[10px] text-blue-700 hover:underline">View {item.skill} in Skill Profile →</Link>
              </section>
                )
              })()
            ))}
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Learning completion is visible; no certificates or uploaded evidence links are assumed.</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><TrendingUp size={14} aria-hidden="true" /></span>Skills to develop</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {path.skillsToDevelop.map((item) => (
              <section key={item.skill} className="py-2 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-slate-800">{item.skill}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
              </section>
            ))}
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">{developingSkills.length ? `Your roadmap has ${developingSkills.map(({ title, status }) => `${title} (${status === 'in-progress' ? 'in progress' : 'up next'})`).join(', ')}.` : 'All roadmap skills are completed.'}</p>
        </article>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-blue-50/70 p-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p><span className="font-semibold">{roadmapSummary.targetRole} stays your primary goal.</span> Exploring this path does not create an application.</p>
      </div>
      {secondaryGoal && <p role="status" className="text-xs text-emerald-700">{path.title} marked as a secondary goal for this session. Your primary goal is unchanged.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSecondaryGoal((value) => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-xs font-semibold text-blue-700 hover:bg-blue-50">{secondaryGoal ? 'Remove secondary goal' : 'Set as Secondary Goal'}</button>
        <Link to="/app/roadmap" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">View Suggested Roadmap <ArrowRight size={13} aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
