import { workspaceStyles } from '../../../workspace/workspaceStyles'
import { BriefcaseBusiness, Info, Layers, MapPin, RefreshCw, SlidersHorizontal, Sparkles, Target } from 'lucide-react'
import { FilterSelect } from '../shared/FilterSelect'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog'
import type { JobFilters, JobRecommendationsResponse } from '../../type'

type Props = {
  data: JobRecommendationsResponse
  filters: JobFilters
  isRefreshing: boolean
  onRefresh: () => void
  onChange: (filters: JobFilters) => void
}


export function JobRecommendationsToolbar({ data, filters, isRefreshing, onRefresh, onChange }: Props) {
  const hasFilters = Boolean(filters.location || filters.employmentType || filters.skillId || filters.sort !== 'semantic')
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl border border-border bg-gradient-to-br from-sky-50 via-white to-blue-100/60 p-4 shadow-sm">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100/70 text-blue-600"><Sparkles className="size-6" aria-hidden="true" /></span>
        <div><h2 className={workspaceStyles.sectionTitle}>Recommended for you</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Jobs matched to your confirmed skills and saved career goal.</p></div>
      </div>
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><Target className="size-4 shrink-0" aria-hidden="true" /><span className="break-words">Career goal: {data.targetRole || 'Not set'}</span></span>
      <Dialog>
        <DialogTrigger asChild><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"><Info className="size-4" aria-hidden="true" />How matching works</button></DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>How matching works</DialogTitle><DialogDescription>Knowledge similarity and skill coverage help you explore openings. Neither predicts hiring.</DialogDescription></DialogHeader>
          <ul className="list-inside list-disc space-y-3 text-sm leading-6 text-slate-600">{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="text-sm leading-6 text-slate-600">By default, jobs with complete document vectors are ranked by knowledge similarity, followed by confirmed skill coverage and your target career. Jobs without complete vectors follow using confirmed overlap. Coverage counts only confirmed skills with the same skill ID; semantic similarity never marks a related skill as confirmed.</p>
          <p className="text-sm leading-6 text-slate-600">Location, employment type, and skills narrow your results. The Skills filter looks for that required or preferred skill in the posting. These filters do not add points to the score.</p>
        </DialogContent>
      </Dialog>
      <button type="button" disabled={isRefreshing} onClick={onRefresh} className={workspaceStyles.outlineAction}><RefreshCw className={`size-4 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />Refresh matches</button>
    </div>
    <p role="status" className="text-xs leading-5 text-slate-500">{isRefreshing ? 'Updating matches…' : `Showing ${data.returnedCount} of ${data.filteredCount} matching jobs · ${data.totalMatched} matches from ${data.totalCandidates} catalog postings · ${data.unscoredPostings} postings have no scorable skill data.`}</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <FilterSelect label="Sort by" icon={SlidersHorizontal} value={filters.sort} onChange={(value) => onChange({ ...filters, sort: value as JobFilters['sort'] })} options={[{ value: 'semantic', label: 'Highest knowledge similarity' }, { value: 'coverage', label: 'Highest skill coverage' }, { value: 'recent', label: 'Newest postings' }]} />
      <FilterSelect label="Location" icon={MapPin} value={filters.location} onChange={(value) => onChange({ ...filters, location: value })} options={[{ value: '', label: 'All' }, ...data.filterOptions.locations.map((value) => ({ value, label: value }))]} />
      <FilterSelect label="Employment" icon={BriefcaseBusiness} value={filters.employmentType} onChange={(value) => onChange({ ...filters, employmentType: value })} options={[{ value: '', label: 'All' }, ...data.filterOptions.employmentTypes.map((value) => ({ value, label: value }))]} />
      <FilterSelect label="Skills" icon={Layers} value={filters.skillId} onChange={(value) => onChange({ ...filters, skillId: value })} options={[{ value: '', label: 'Any' }, ...data.filterOptions.skills.map((skill) => ({ value: String(skill.skillId), label: skill.name }))]} />
    </div>
    {hasFilters && <button type="button" onClick={() => onChange({ sort: 'semantic', location: '', employmentType: '', skillId: '' })} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Clear filters</button>}
  </div>
}
