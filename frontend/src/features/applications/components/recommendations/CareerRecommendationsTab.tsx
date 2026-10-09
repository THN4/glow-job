import { ArrowRight, Layers3, Settings2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CareerRecommendationDetail } from './CareerRecommendationDetail'
import type { CareerPathRecommendation } from '../../type'
import { careerPathRecommendations } from '../../data/careerPathMockData'

type CareerRecommendationsTabProps = {
  selectedPath: CareerPathRecommendation | null
  onSelectPath: (path: CareerPathRecommendation) => void
}

const toneClasses = {
  blue: { card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-50 text-blue-600' },
  violet: { card: 'border-violet-100 bg-violet-50/40', icon: 'bg-violet-50 text-violet-600' },
  emerald: { card: 'border-emerald-100 bg-emerald-50/40', icon: 'bg-emerald-50 text-emerald-600' },
}

export function CareerRecommendationsTab({ selectedPath, onSelectPath }: CareerRecommendationsTabProps) {
  if (selectedPath) return <CareerRecommendationDetail path={selectedPath} />

  return (
    <section aria-label="Career recommendations" className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
        <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div><p className="font-semibold">Your primary goal stays Data Engineer Internship.</p><p className="mt-0.5 text-slate-600">These are career directions to explore, not job postings or confirmed employment matches.</p></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {careerPathRecommendations.map((path) => (
          <article key={path.id} className={`flex flex-col rounded-xl border p-3 shadow-sm ${toneClasses[path.iconTone].card}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[path.iconTone].icon}`}><Settings2 size={16} aria-hidden="true" /></span>
              <h2 className="text-sm font-bold text-slate-900">{path.title}</h2>
            </div>
            <p className="mt-3 min-h-12 text-xs leading-relaxed text-slate-500">{path.summary}</p>
            <div className="mt-2 border-t border-slate-200/70 pt-2">
              <h3 className="text-[11px] font-bold text-slate-800">Transferable skills</h3>
              <p className="mt-1 text-[11px] text-slate-600">{path.transferableSkills.join(' · ')}</p>
              <h3 className="mt-2 text-[11px] font-bold text-slate-800">Development areas</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{path.developmentAreas.join(', ')}</p>
            </div>
            <button type="button" onClick={() => onSelectPath(path)} className="mt-3 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-4 text-xs font-semibold text-blue-700 hover:bg-blue-50">View Career Path <ArrowRight size={13} aria-hidden="true" /></button>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Layers3 size={14} aria-hidden="true" /></span>What these suggestions are based on</h2>
        <div className="mt-2 grid gap-3 text-[11px] leading-relaxed text-slate-600 md:grid-cols-3">
          <div><h3 className="font-semibold text-slate-800">Completed learning</h3><p className="mt-1">Python, SQL and ETL Pipelines are marked completed. Build ETL Project is also completed on your roadmap.</p><Link to="/app/skill-profile" className="mt-1 inline-block text-blue-700 hover:underline">View Skill Profile →</Link></div>
          <div><h3 className="font-semibold text-slate-800">Education and experience</h3><p className="mt-1">B.Sc. Computer Science and freelance web development provide a technical foundation for related paths.</p><p className="mt-1 text-slate-500">No certificates or project links are assumed.</p></div>
          <div><h3 className="font-semibold text-slate-800">Still developing</h3><p className="mt-1">Docker is In progress. Airflow is Upcoming, not a mastered skill.</p><Link to="/app/roadmap" className="mt-1 inline-block text-blue-700 hover:underline">View My Roadmap →</Link></div>
        </div>
      </section>
    </section>
  )
}
