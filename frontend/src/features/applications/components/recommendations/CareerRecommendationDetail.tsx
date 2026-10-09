import { useState } from 'react'
import { ArrowRight, CheckCircle2, Info, Layers3, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CareerPathRecommendation } from '../../type'

type CareerRecommendationDetailProps = {
  path: CareerPathRecommendation
}

export function CareerRecommendationDetail({ path }: CareerRecommendationDetailProps) {
  const [secondaryGoal, setSecondaryGoal] = useState(false)

  return (
    <section aria-label={`${path.title} career path details`} className="space-y-3">
      <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">{<TrendingUp size={14} aria-hidden="true" />}</span>Why this path is worth exploring</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{path.whyExplore}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Typical work: {path.developmentAreas.slice(0, 3).join(', ')} and collaborate with analysts on trustworthy metrics.</p>
      </article>

      <div className="grid items-start gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Layers3 size={14} aria-hidden="true" /></span>Supported by your profile</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {path.supportedProfile.map((item) => (
              <section key={item.skill} className="py-2 first:pt-0 last:pb-0">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />{item.skill}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
                <Link to="/app/skill-profile" className="mt-1 inline-block text-[10px] text-blue-700 hover:underline">View {item.skill} in Skill Profile →</Link>
              </section>
            ))}
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Learning completion is visible; no certificates or uploaded evidence links are assumed.</p>
        </article>

        <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><TrendingUp size={14} aria-hidden="true" /></span>Skills to develop</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {path.skillsToDevelop.map((item) => (
              <section key={item.skill} className="py-2 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-slate-800">{item.skill}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
              </section>
            ))}
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Docker is In progress and Airflow is Upcoming. Neither is treated as mastered.</p>
        </article>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p><span className="font-semibold">Data Engineer Internship stays your primary goal.</span> Exploring this path does not create an application.</p>
      </div>
      {secondaryGoal && <p role="status" className="text-xs text-emerald-700">{path.title} marked as a secondary goal for this session. Your primary goal is unchanged.</p>}
      <div className="flex flex-wrap gap-2">
        <Link to="/app/roadmap" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">View Suggested Roadmap <ArrowRight size={13} aria-hidden="true" /></Link>
        <button type="button" onClick={() => setSecondaryGoal((value) => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-xs font-semibold text-blue-700 hover:bg-blue-50">{secondaryGoal ? 'Remove secondary goal' : 'Set as Secondary Goal'}</button>
      </div>
    </section>
  )
}
