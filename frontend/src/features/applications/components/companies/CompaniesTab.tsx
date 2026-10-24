import { workspaceStyles } from '../../../workspace/workspaceStyles'
import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react'
import { CompanyOpeningDetail } from './CompanyOpeningDetail'
import { companyAvatarColor } from '../shared/companyAvatar'
import { FilterSelect } from '../shared/FilterSelect'
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
  const [page, setPage] = useState(1)

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
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(filteredOpenings.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const firstIndex = (currentPage - 1) * pageSize
  const pageOpenings = filteredOpenings.slice(firstIndex, firstIndex + pageSize)

  return (
    <section aria-label="Companies and job openings" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <FilterSelect label="Role" icon={Search} value={role} onChange={(value) => { setRole(value); setPage(1) }}
          options={[{ value: 'all', label: 'All job titles' }, ...roles.map((value) => ({ value, label: value }))]} />
        <FilterSelect label="Location" icon={MapPin} value={location} onChange={(value) => { setLocation(value); setPage(1) }}
          options={[{ value: 'all', label: 'All locations' }, ...locations.map((value) => ({ value, label: value }))]} />
        <FilterSelect label="Employment" icon={BriefcaseBusiness} value={experience} onChange={(value) => { setExperience(value); setPage(1) }}
          options={[{ value: 'all', label: 'All types' }, ...experiences.map((value) => ({ value, label: value }))]} />
      </div>

      {filteredOpenings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageOpenings.map((opening) => (
            <article key={opening.id} className="flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-blue-400 hover:shadow-md focus-within:border-blue-400">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${companyAvatarColor(opening.company)}`}>{opening.company.slice(0, 2).toUpperCase()}</span>
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
      {filteredOpenings.length > 0 && <nav aria-label="Company opening pages" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Showing {firstIndex + 1}–{Math.min(firstIndex + pageSize, filteredOpenings.length)} of {filteredOpenings.length} openings
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className={workspaceStyles.outlineAction}>
            <ChevronLeft size={16} aria-hidden="true" />Previous
          </button>
          <span className="text-xs text-muted-foreground">Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className={workspaceStyles.outlineAction}>
            Next<ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>}
      <p className="text-xs leading-relaxed text-slate-500">Postings and skill requirements come from the shared job database. Verify the source before relying on the details.</p>
    </section>
  )
}
