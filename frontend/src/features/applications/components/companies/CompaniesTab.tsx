import { workspaceStyles } from '../../../workspace/workspaceStyles'
import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { CompanyOpeningDetail } from './CompanyOpeningDetail'
import type { CompanyOpening } from '../../type'
import type { RoadmapNodeData } from '../../../roadmap/type'

type CompaniesTabProps = {
  applications: { jobId?: string | null }[]
  openings: CompanyOpening[]
  selectedOpening: CompanyOpening | null
  onAddOpening: (opening: CompanyOpening) => Promise<void>
  onSelectedOpeningChange: (opening: CompanyOpening | null) => void
  roadmapNodes: RoadmapNodeData[]
  canSave: boolean
  isSaving: boolean
}

function optionValues(openings: CompanyOpening[], pick: (opening: CompanyOpening) => string) {
  return [...new Set(openings.map(pick).filter((value) => value && value !== 'Not specified'))].sort((a, b) => a.localeCompare(b))
}

export function CompaniesTab({ applications, openings, selectedOpening, onAddOpening, onSelectedOpeningChange, roadmapNodes, canSave, isSaving }: CompaniesTabProps) {
  const [role, setRole] = useState('all')
  const [location, setLocation] = useState('all')
  const [experience, setExperience] = useState('all')

  if (selectedOpening) {
    const alreadySaved = applications.some((application) => application.jobId === String(selectedOpening.jobId))
    return <CompanyOpeningDetail
      opening={selectedOpening}
      alreadySaved={alreadySaved}
      canSave={canSave}
      isSaving={isSaving}
      onAddToApplications={() => onAddOpening(selectedOpening)}
      onBack={() => onSelectedOpeningChange(null)}
      roadmapNodes={roadmapNodes}
    />
  }

  const roles = optionValues(openings, (opening) => opening.role)
  const locations = optionValues(openings, (opening) => opening.location)
  const experiences = optionValues(openings, (opening) => opening.experience)
  const filteredOpenings = openings.filter((opening) =>
    (role === 'all' || opening.role === role)
    && (location === 'all' || opening.location === location)
    && (experience === 'all' || opening.experience === experience),
  )

  return (
    <section aria-label="Companies and job openings" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="sr-only" htmlFor="company-role-filter">Role</label>
        <select id="company-role-filter" value={role} onChange={(event) => setRole(event.target.value)} className={workspaceStyles.filter}>
          <option value="all">Role: All job titles</option>{roles.map((value) => <option key={value}>{value}</option>)}
        </select>
        <label className="sr-only" htmlFor="company-location-filter">Location</label>
        <select id="company-location-filter" value={location} onChange={(event) => setLocation(event.target.value)} className={workspaceStyles.filter}>
          <option value="all">Location: All locations</option>{locations.map((value) => <option key={value}>{value}</option>)}
        </select>
        <label className="sr-only" htmlFor="company-experience-filter">Employment type</label>
        <select id="company-experience-filter" value={experience} onChange={(event) => setExperience(event.target.value)} className={workspaceStyles.filter}>
          <option value="all">Employment type: All</option>{experiences.map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>

      {filteredOpenings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOpenings.map((opening) => (
            <article key={opening.id} className="flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-blue-400 hover:shadow-md focus-within:border-blue-400">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">{opening.company.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{opening.company}</h3><p className="truncate text-xs font-medium text-slate-700">{opening.role}</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-500"><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{opening.location} · {opening.workStyle} · {opening.experience}</p>
              <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600">{opening.description || 'No description provided by the posting source.'}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {[...opening.requiredSkills, ...opening.preferredSkills].slice(0, 5).map((skill) => (
                  <span key={skill} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{skill}</span>
                ))}
              </div>
              <div className="mt-auto flex flex-row-reverse flex-wrap items-end justify-between gap-2 pt-3">
                <button type="button" onClick={() => onSelectedOpeningChange(opening)} className={workspaceStyles.primaryAction}>View Job <ArrowRight size={13} aria-hidden="true" /></button>
                <span className="text-xs text-slate-400">{opening.publisher}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {openings.length ? 'No job postings match these filters.' : 'There are no job postings in the database yet.'}
        </p>
      )}
      <p className="text-xs leading-relaxed text-slate-500">Postings and skill requirements come from the shared job database. Verify the source before relying on the details.</p>
    </section>
  )
}
