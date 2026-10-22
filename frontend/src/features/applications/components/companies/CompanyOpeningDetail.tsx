import { useState } from 'react'
import { ArrowLeft, CheckCircle2, FileText, Info, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CompanyOpening } from '../../data/companyOpenings'
import type { RoadmapNodeData } from '../../../roadmap/type'

type CompanyOpeningDetailProps = {
  opening: CompanyOpening
  alreadySaved: boolean
  onAddToApplications: () => void
  onBack: () => void
  roadmapNodes: RoadmapNodeData[]
}

export function CompanyOpeningDetail({ opening, alreadySaved, onAddToApplications, onBack, roadmapNodes }: CompanyOpeningDetailProps) {
  const [added, setAdded] = useState(false)

  function addOpening() {
    if (!alreadySaved && !added) {
      onAddToApplications()
      setAdded(true)
    }
  }

  const saved = alreadySaved || added
  const relatedSkills = opening.relatedSkillIds
    .map((id) => roadmapNodes.find((node) => node.id === id))
    .filter((node): node is RoadmapNodeData => Boolean(node))
  const statusLabel = (status: RoadmapNodeData['status']) => status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Up next'
  const statusClass = (status: RoadmapNodeData['status']) => status === 'completed' ? 'bg-emerald-50 text-emerald-700' : status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'

  return (
    <section aria-label={`${opening.company} ${opening.role} job details`} className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-blue-50/70 p-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div><p className="font-semibold">From the app’s job database · Sample opening</p><p className="mt-0.5 text-blue-700">Illustrative content, not a verified live posting. {alreadySaved ? 'This opening is already in your tracker.' : 'This job is not in your tracker yet.'}</p></div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(250px,0.8fr)]">
        <div className="space-y-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft size={14} aria-hidden="true" />Back to Companies</button>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400 sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FileText size={16} aria-hidden="true" /></span>Complete sample job description</h3>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
            <section><h4 className="font-bold text-slate-800">About the role</h4><p className="mt-1">{opening.jobDescription}</p></section>
            <section><h4 className="font-bold text-slate-800">Responsibilities</h4><ul className="mt-1 list-inside list-disc">{['Build and maintain data pipelines and transformation tasks.', 'Validate source data, investigate quality issues and document changes.', 'Collaborate with analysts and engineers to deliver reliable datasets.'].map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h4 className="font-bold text-slate-800">Required skills</h4><ul className="mt-1 list-inside list-disc">{opening.requiredSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul></section>
            <section><h4 className="font-bold text-slate-800">Preferred skills</h4><ul className="mt-1 list-inside list-disc">{opening.preferredSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul></section>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-500">Sample job description for prototype purposes. Review the source before relying on any requirement.</p>
          </article>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={15} aria-hidden="true" /></span>How your profile relates</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Based on visible learning and experience—not a numerical fit score.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {relatedSkills.map((skill) => <span key={skill.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(skill.status)}`}>{skill.title} · {statusLabel(skill.status)}</span>)}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Roadmap statuses are shown live. Completion reflects learning progress; evidence and proficiency may still need review.</p>
          <Link to="/app/skill-profile" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline">View supporting Skill Profile <ArrowLeft size={11} className="rotate-180" aria-hidden="true" /></Link>

          <div className="my-3 border-t border-slate-100" />
          <h4 className="text-xs font-bold text-slate-900">Potential gaps</h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{opening.preferredSkills.slice(0, 2).join(' and ')} are not both supported by completed roadmap skills. Compare these sample requirements with your own experience.</p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">A job description is not a verified study or work requirement. Completion is not the same as verified work experience.</p>

          <button type="button" disabled={saved} onClick={addOpening} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-default disabled:bg-emerald-600">
            {saved ? <CheckCircle2 size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{saved ? 'Added to My Applications' : 'Add to My Applications'}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{saved ? 'Saved to your personal tracker. Nothing has been submitted to the employer.' : 'Next: review the imported details. Nothing is saved or submitted until you confirm.'}</p>
        </aside>
      </div>
    </section>
  )
}
