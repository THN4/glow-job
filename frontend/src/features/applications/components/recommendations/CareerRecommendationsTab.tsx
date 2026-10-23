import { workspaceStyles } from '../../../workspace/workspaceStyles'
import { ArrowRight, Layers3, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CareerRecommendationDetail } from './CareerRecommendationDetail'
import { CareerPathIcon } from './CareerPathIcon'
import type { CareerPathRecommendation } from '../../type'
import type { RoadmapNodeData } from '../../../roadmap/type'

type CareerRecommendationsTabProps = {
  selectedPath: CareerPathRecommendation | null
  onSelectPath: (path: CareerPathRecommendation | null) => void
  roadmapNodes: RoadmapNodeData[]
  targetRole: string | null
  recommendations: CareerPathRecommendation[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

const toneClasses = {
  blue: { card: 'border-slate-200', icon: 'bg-blue-50 text-blue-600' },
  violet: { card: 'border-slate-200', icon: 'bg-violet-50 text-violet-600' },
  emerald: { card: 'border-slate-200', icon: 'bg-emerald-50 text-emerald-600' },
}

export function CareerRecommendationsTab({
  selectedPath, onSelectPath, roadmapNodes, targetRole, recommendations,
  isLoading, error, onRetry,
}: CareerRecommendationsTabProps) {
  if (selectedPath) return <CareerRecommendationDetail path={selectedPath} roadmapNodes={roadmapNodes} primaryTargetRole={targetRole} onBack={() => onSelectPath(null)} />
  const completed = roadmapNodes.filter((node) => node.status === 'completed' && ['skill', 'project'].includes(node.kind))
  const developing = roadmapNodes.filter((node) => node.status !== 'completed' && node.kind === 'skill')

  return (
    <section aria-label="Career recommendations" className="flex flex-1 flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-blue-800">
        <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{targetRole ? `Your saved primary goal is ${targetRole}.` : 'Explore career directions from your saved profile.'}</p>
          <p className="mt-0.5 text-slate-600">Recommendations compare confirmed profile skills with skill demand in the market database. They are not job-fit scores or hiring predictions.</p>
        </div>
      </div>

      {isLoading && <p role="status" className="rounded-xl border border-blue-100 bg-white p-8 text-center text-sm text-slate-600">Comparing your profile with market career data…</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-white p-8 text-center"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Try again</button></div>}
      {!isLoading && !error && recommendations.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No career recommendations are available yet. Market skill statistics may not be ready for any career profile.</p>}
      {!isLoading && !error && recommendations.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {recommendations.map((path) => (
          <article key={path.id} className={`flex flex-col rounded-xl border bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-blue-400 hover:shadow-md focus-within:border-blue-400 ${toneClasses[path.iconTone].card}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[path.iconTone].icon}`}><CareerPathIcon pathId={path.id} size={18} /></span>
              <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">{path.title}</h2><p className="text-xs text-slate-500">{path.careerName} · {path.seniorityLevel}</p></div>
            </div>
            <p className="mt-3 min-h-12 text-xs leading-relaxed text-slate-500">{path.summary}</p>
            <div className="mt-2 border-t border-slate-200/70 pt-2">
              <h3 className="text-xs font-bold text-slate-800">Skills found in your profile</h3>
              <p className="mt-1 text-xs text-slate-600">{path.transferableSkills.length ? path.transferableSkills.join(' · ') : 'No matching confirmed skills found.'}</p>
              <h3 className="mt-2 text-xs font-bold text-slate-800">Skills to review</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{path.developmentAreas.length ? path.developmentAreas.join(', ') : 'No unconfirmed skill gaps in the available market data.'}</p>
            </div>
            <div className="mt-auto flex justify-end pt-3">
              <button type="button" onClick={() => onSelectPath(path)} className={workspaceStyles.primaryAction}>View Career Path <ArrowRight size={13} aria-hidden="true" /></button>
            </div>
          </article>
        ))}
      </div>}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm lg:sticky lg:bottom-0 lg:mt-auto">
        <h2 className={`flex items-center gap-2 ${workspaceStyles.sectionTitle}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Layers3 size={14} aria-hidden="true" /></span>What these suggestions are based on</h2>
        <div className="mt-2 grid gap-3 text-xs leading-relaxed text-slate-600 md:grid-cols-3">
          <div><h3 className="font-semibold text-slate-800">Saved career goal</h3><p className="mt-1">{targetRole || 'No primary career goal is saved.'}</p><Link to="/onboarding" className="mt-1 inline-block text-blue-700 hover:underline">Review career goal →</Link></div>
          <div><h3 className="font-semibold text-slate-800">Completed learning</h3><p className="mt-1">{completed.length ? completed.map(({ title }) => title).join(', ') : 'No roadmap skills or projects are completed yet.'}</p><Link to="/app/skill-profile" className="mt-1 inline-block text-blue-700 hover:underline">View Skill Profile →</Link></div>
          <div><h3 className="font-semibold text-slate-800">Still developing</h3><p className="mt-1">{developing.length ? developing.map(({ title, status }) => `${title} (${status === 'in-progress' ? 'in progress' : 'up next'})`).join(', ') : 'All roadmap skills are completed.'}</p><Link to="/app/roadmap" className="mt-1 inline-block text-blue-700 hover:underline">View My Roadmap →</Link></div>
        </div>
      </section>
    </section>
  )
}
