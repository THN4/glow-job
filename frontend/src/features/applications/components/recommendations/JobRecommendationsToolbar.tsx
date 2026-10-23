import { BriefcaseBusiness, ChevronDown, Info, Layers, MapPin, RefreshCw, SlidersHorizontal, Sparkles, Target, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog'
import type { JobFilters, JobRecommendationsResponse } from '../../type'

type Props = {
  data: JobRecommendationsResponse
  filters: JobFilters
  isRefreshing: boolean
  onRefresh: () => void
  onChange: (filters: JobFilters) => void
}

function FilterSelect({ label, icon: Icon, value, onChange, options }: {
  label: string; icon: LucideIcon; value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const displayedOptions = options.some((option) => option.value === value)
    ? options : [...options, { value, label: value }]
  return <label className="relative flex min-w-0 items-center">
    <span className="sr-only">{label}</span>
    <Icon className="pointer-events-none absolute left-3 size-4 text-blue-600" aria-hidden="true" />
    <select value={value} onChange={(event) => onChange(event.target.value)}
      className="min-h-11 w-full min-w-0 appearance-none truncate rounded-xl border border-blue-100 bg-white py-2 pl-10 pr-9 text-xs text-slate-700 shadow-sm outline-none transition hover:border-blue-300 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100">
      {displayedOptions.map((option) => <option key={option.value} value={option.value}>{label}: {option.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-slate-400" aria-hidden="true" />
  </label>
}

export function JobRecommendationsToolbar({ data, filters, isRefreshing, onRefresh, onChange }: Props) {
  const hasFilters = Boolean(filters.location || filters.employmentType || filters.skillId || filters.sort !== 'coverage')
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-sky-50 via-white to-blue-100/60 p-4 shadow-sm">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100/70 text-blue-600"><Sparkles className="size-6" aria-hidden="true" /></span>
        <div><h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Recommended for you</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Jobs matched to your confirmed skills and saved career goal.</p></div>
      </div>
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><Target className="size-4 shrink-0" aria-hidden="true" /><span className="break-words">Career goal: {data.targetRole || 'Not set'}</span></span>
      <Dialog>
        <DialogTrigger asChild><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"><Info className="size-4" aria-hidden="true" />How matching works</button></DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>How matching works</DialogTitle><DialogDescription>Skill coverage helps you explore relevant openings. It is not a hiring prediction.</DialogDescription></DialogHeader>
          <ul className="list-inside list-disc space-y-3 text-sm leading-6 text-slate-600">{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="text-sm leading-6 text-slate-600">Coverage is matched weighted skill points divided by all scored skill points. Equal coverage scores are ordered by target career, then required skill overlap.</p>
          <p className="text-sm leading-6 text-slate-600">Location, employment type, and skills narrow your results. The Skills filter looks for that required or preferred skill in the posting. These filters do not add points to the score.</p>
        </DialogContent>
      </Dialog>
      <button type="button" disabled={isRefreshing} onClick={onRefresh} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`size-4 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />Refresh matches</button>
    </div>
    <p role="status" className="text-xs leading-5 text-slate-500">{isRefreshing ? 'Updating matches…' : `Showing ${data.returnedCount} of ${data.filteredCount} matching jobs · ${data.totalMatched} matches from ${data.totalCandidates} catalog postings · ${data.unscoredPostings} postings have no scorable skill data.`}</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <FilterSelect label="Sort by" icon={SlidersHorizontal} value={filters.sort} onChange={(value) => onChange({ ...filters, sort: value as JobFilters['sort'] })} options={[{ value: 'coverage', label: 'Highest skill coverage' }, { value: 'recent', label: 'Newest postings' }]} />
      <FilterSelect label="Location" icon={MapPin} value={filters.location} onChange={(value) => onChange({ ...filters, location: value })} options={[{ value: '', label: 'All' }, ...data.filterOptions.locations.map((value) => ({ value, label: value }))]} />
      <FilterSelect label="Employment" icon={BriefcaseBusiness} value={filters.employmentType} onChange={(value) => onChange({ ...filters, employmentType: value })} options={[{ value: '', label: 'All' }, ...data.filterOptions.employmentTypes.map((value) => ({ value, label: value }))]} />
      <FilterSelect label="Skills" icon={Layers} value={filters.skillId} onChange={(value) => onChange({ ...filters, skillId: value })} options={[{ value: '', label: 'Any' }, ...data.filterOptions.skills.map((skill) => ({ value: String(skill.skillId), label: skill.name }))]} />
    </div>
    {hasFilters && <button type="button" onClick={() => onChange({ sort: 'coverage', location: '', employmentType: '', skillId: '' })} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Clear filters</button>}
  </div>
}
