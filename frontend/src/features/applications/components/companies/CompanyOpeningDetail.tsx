import { useState } from 'react'
import { ArrowLeft, CheckCircle2, FileText, Info, Plus } from 'lucide-react'
import { StatusIcon } from '../../../../components/StatusIcon'
import { Link } from 'react-router-dom'
import type { CompanyOpening } from '../../type'
import type { RoadmapNodeData } from '../../../roadmap/type'

type CompanyOpeningDetailProps = {
  opening: CompanyOpening
  alreadySaved: boolean
  onAddToApplications: () => Promise<void>
  onBack: () => void
  roadmapNodes: RoadmapNodeData[]
  canSave: boolean
  isSaving: boolean
}

export function CompanyOpeningDetail({ opening, alreadySaved, onAddToApplications, onBack, roadmapNodes, canSave, isSaving }: CompanyOpeningDetailProps) {
  const [added, setAdded] = useState(false)

  async function addOpening() {
    if (!alreadySaved && !added) {
      try {
        await onAddToApplications()
        setAdded(true)
      } catch {
        // The parent displays the API error and keeps this posting available to retry.
      }
    }
  }

  const saved = alreadySaved || added
  const postingSkills = [...new Set([...opening.requiredSkills, ...opening.preferredSkills])]
  const relatedSkills = postingSkills.map((name) => ({
    name,
    node: roadmapNodes.find((node) => node.kind === 'skill' && (node.title.toLowerCase() === name.toLowerCase() || node.id.toLowerCase() === name.toLowerCase().replace(/\s+/g, '-'))),
  })).filter((item) => item.node)
  const statusLabel = (status: RoadmapNodeData['status']) => status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Up next'
  const statusClass = (status: RoadmapNodeData['status']) => status === 'completed' ? 'bg-emerald-50 text-emerald-700' : status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'

  return (
    <section aria-label={`${opening.company} ${opening.role} job details`} className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-blue-50/70 p-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div><p className="font-semibold">From the shared job database · {opening.publisher}</p><p className="mt-0.5 text-blue-700">{alreadySaved ? 'This posting is already in your tracker.' : 'Review the source details before saving this posting.'}</p></div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(250px,0.8fr)]">
        <div className="space-y-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft size={14} aria-hidden="true" />Back to Companies</button>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400 sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FileText size={16} aria-hidden="true" /></span>Job description</h3>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
            <p className="whitespace-pre-line">{opening.jobDescription || 'The source did not provide a job description.'}</p>
            <section><h4 className="font-bold text-slate-800">Required skills</h4>{opening.requiredSkills.length ? <ul className="mt-1 list-inside list-disc">{opening.requiredSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="mt-1">No required skills were extracted.</p>}</section>
            <section><h4 className="font-bold text-slate-800">Preferred skills</h4>{opening.preferredSkills.length ? <ul className="mt-1 list-inside list-disc">{opening.preferredSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="mt-1">No preferred skills were extracted.</p>}</section>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500"><span>{opening.postedAt ? `Posted ${new Date(opening.postedAt).toLocaleDateString()}` : 'Posting date not provided'}</span>{opening.sourceUrl && <a href={opening.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">Open source posting</a>}</div>
          </article>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 focus-within:border-blue-400 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={15} aria-hidden="true" /></span>How your profile relates</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">These are name matches to roadmap skills, not an assessment of your experience.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {relatedSkills.map(({ name, node }) => <span key={name} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(node!.status)}`}><StatusIcon status={node!.status} size={12} />{name} · {statusLabel(node!.status)}</span>)}
          </div>
          {!relatedSkills.length && <p className="mt-2 text-[11px] text-slate-500">No posting skills match the current roadmap labels.</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Roadmap status reflects learning progress; it does not verify job experience.</p>
          <Link to="/app/skill-profile" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline">View supporting Skill Profile <ArrowLeft size={11} className="rotate-180" aria-hidden="true" /></Link>

          <div className="my-3 border-t border-slate-100" />
          <h4 className="text-xs font-bold text-slate-900">About extracted skills</h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">Skill labels come from the posting data. Check the source before using them to judge role fit.</p>

          <button type="button" disabled={saved || isSaving || !canSave} onClick={addOpening} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-default disabled:bg-emerald-600">
            {saved ? <CheckCircle2 size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{saved ? 'Added to My Applications' : isSaving ? 'Saving…' : canSave ? 'Add to My Applications' : 'Save profile first'}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{saved ? 'Saved to your personal tracker. Nothing has been submitted to the employer.' : canSave ? 'This creates a tracker entry linked to the selected database posting.' : 'Complete onboarding and save your profile before adding postings.'}</p>
        </aside>
      </div>
    </section>
  )
}
