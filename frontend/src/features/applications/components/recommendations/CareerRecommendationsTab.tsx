import { ArrowRight, Layers3, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CareerRecommendationDetail } from './CareerRecommendationDetail'
import { CareerPathIcon } from './CareerPathIcon'
import type { CareerPathRecommendation } from '../../type'
import { careerPathRecommendations } from '../../data/careerPathMockData'
import type { RoadmapNodeData } from '../../../roadmap/type'
import { roadmapSummary } from '../../../roadmap/data/roadmapMockData'

type CareerRecommendationsTabProps = {
  selectedPath: CareerPathRecommendation | null
  onSelectPath: (path: CareerPathRecommendation | null) => void
  roadmapNodes: RoadmapNodeData[]
}

const toneClasses = {
  blue: { card: 'border-slate-200', icon: 'bg-blue-50 text-blue-600' },
  violet: { card: 'border-slate-200', icon: 'bg-violet-50 text-violet-600' },
  emerald: { card: 'border-slate-200', icon: 'bg-emerald-50 text-emerald-600' },
}

export function CareerRecommendationsTab({ selectedPath, onSelectPath, roadmapNodes }: CareerRecommendationsTabProps) {
  if (selectedPath) return <CareerRecommendationDetail path={selectedPath} roadmapNodes={roadmapNodes} onBack={() => onSelectPath(null)} />
  const completed = roadmapNodes.filter((node) => node.status === 'completed' && ['skill', 'project'].includes(node.kind))
  const developing = roadmapNodes.filter((node) => node.status !== 'completed' && node.kind === 'skill')

  return (
    <section aria-label="Career recommendations" className="flex flex-1 flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-blue-800">
        <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div><p className="font-semibold">Your primary goal stays {roadmapSummary.targetRole}.</p><p className="mt-0.5 text-slate-600">These are career directions to explore, not job postings or confirmed employment matches.</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {careerPathRecommendations.map((path) => (
          <article key={path.id} className={`flex flex-col rounded-xl border bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-blue-400 hover:shadow-md focus-within:border-blue-400 ${toneClasses[path.iconTone].card}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[path.iconTone].icon}`}><CareerPathIcon pathId={path.id} size={18} /></span>
              <h2 className="text-sm font-bold text-slate-900">{path.title}</h2>
            </div>
            <p className="mt-3 min-h-12 text-xs leading-relaxed text-slate-500">{path.summary}</p>
            <div className="mt-2 border-t border-slate-200/70 pt-2">
              <h3 className="text-[11px] font-bold text-slate-800">Transferable skills</h3>
              <p className="mt-1 text-[11px] text-slate-600">{path.transferableSkills.join(' · ')}</p>
              <h3 className="mt-2 text-[11px] font-bold text-slate-800">Development areas</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{path.developmentAreas.join(', ')}</p>
            </div>
            <div className="mt-auto flex justify-end pt-3">
              <button type="button" onClick={() => onSelectPath(path)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View Career Path <ArrowRight size={13} aria-hidden="true" /></button>
            </div>
          </article>
        ))}
      </div>

      <section className="border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:bottom-0 lg:mt-auto">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Layers3 size={14} aria-hidden="true" /></span>What these suggestions are based on</h2>
        <div className="mt-2 grid gap-3 text-[11px] leading-relaxed text-slate-600 md:grid-cols-3">
          <div><h3 className="font-semibold text-slate-800">Completed learning</h3><p className="mt-1">{completed.length ? completed.map(({ title }) => title).join(', ') : 'No roadmap skills or projects are completed yet.'}</p><Link to="/app/skill-profile" className="mt-1 inline-block text-blue-700 hover:underline">View Skill Profile →</Link></div>
          <div><h3 className="font-semibold text-slate-800">Education and experience</h3><p className="mt-1">B.Sc. Computer Science and freelance web development provide a technical foundation for related paths.</p><p className="mt-1 text-slate-500">No certificates or project links are assumed.</p></div>
          <div><h3 className="font-semibold text-slate-800">Still developing</h3><p className="mt-1">{developing.length ? developing.map(({ title, status }) => `${title} (${status === 'in-progress' ? 'in progress' : 'up next'})`).join(', ') : 'All roadmap skills are completed.'}</p><Link to="/app/roadmap" className="mt-1 inline-block text-blue-700 hover:underline">View My Roadmap →</Link></div>
        </div>
      </section>
    </section>
  )
}
