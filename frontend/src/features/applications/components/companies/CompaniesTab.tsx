import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { CompanyOpeningDetail } from './CompanyOpeningDetail'
import { sampleCompanyOpenings, type CompanyOpening } from '../../data/companyOpenings'
import type { RoadmapNodeData } from '../../../roadmap/type'

const accentClasses: Record<CompanyOpening['accent'], string> = {
  rose: 'bg-rose-700 text-white',
  emerald: 'bg-emerald-700 text-white',
  amber: 'bg-amber-700 text-white',
  violet: 'bg-violet-700 text-white',
  blue: 'bg-blue-700 text-white',
}

type CompaniesTabProps = {
  applications: { company: string; role: string }[]
  selectedOpening: CompanyOpening | null
  onAddOpening: (opening: CompanyOpening) => void
  onSelectedOpeningChange: (opening: CompanyOpening | null) => void
  roadmapNodes: RoadmapNodeData[]
}

export function CompaniesTab({ applications, selectedOpening, onAddOpening, onSelectedOpeningChange, roadmapNodes }: CompaniesTabProps) {
  const [role, setRole] = useState('all')
  const [location, setLocation] = useState('all')
  const [experience, setExperience] = useState('Internship')

  if (selectedOpening) {
    const alreadySaved = applications.some((application) => application.company === selectedOpening.company && application.role === selectedOpening.role)
    return <CompanyOpeningDetail opening={selectedOpening} alreadySaved={alreadySaved} onAddToApplications={() => onAddOpening(selectedOpening)} onBack={() => onSelectedOpeningChange(null)} roadmapNodes={roadmapNodes} />
  }

  const filteredOpenings = sampleCompanyOpenings.filter((opening) =>
    (role === 'all' || opening.role === role)
    && (location === 'all' || opening.location === location)
    && (experience === 'all' || opening.experience === experience),
  )

  return (
    <section aria-label="Companies and sample job openings" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="sr-only" htmlFor="company-role-filter">Role</label>
        <select id="company-role-filter" value={role} onChange={(event) => setRole(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Role: All data roles</option><option>Data Engineer Intern</option><option>Data Analyst Intern</option><option>Analytics Engineer Intern</option>
        </select>
        <label className="sr-only" htmlFor="company-location-filter">Location</label>
        <select id="company-location-filter" value={location} onChange={(event) => setLocation(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Location: All locations</option><option>Bangkok</option><option>Not specified</option>
        </select>
        <label className="sr-only" htmlFor="company-experience-filter">Experience</label>
        <select id="company-experience-filter" value={experience} onChange={(event) => setExperience(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Experience: All levels</option><option>Internship</option>
        </select>
      </div>

      {filteredOpenings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOpenings.map((opening) => (
            <article key={opening.id} className="flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-blue-400 hover:shadow-md focus-within:border-blue-400">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${accentClasses[opening.accent]}`}>{opening.initials}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{opening.company}</h3><p className="truncate text-xs font-medium text-slate-700">{opening.role}</p></div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500"><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{opening.location} · {opening.workStyle} · {opening.experience}</p>
              <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600">{opening.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {opening.relatedSkillIds.map((id) => roadmapNodes.find((node) => node.id === id)).filter((node): node is RoadmapNodeData => Boolean(node && node.kind === 'skill')).map((skill) => (
                  <span key={skill.id} className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${skill.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : skill.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {skill.title} · {skill.status === 'completed' ? 'Completed' : skill.status === 'in-progress' ? 'In progress' : 'Up next'}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex flex-row-reverse flex-wrap items-end justify-between gap-2 pt-3">
                <button type="button" onClick={() => onSelectedOpeningChange(opening)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View Job <ArrowRight size={13} aria-hidden="true" /></button>
                <span className="text-[10px] text-slate-400">App job database · Sample</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No sample openings match these filters.</p>
      )}
      <p className="text-[10px] leading-relaxed text-slate-500">Illustrative database content, not verified live postings. Nothing enters My Applications until you review and save it.</p>
    </section>
  )
}
