import { useState } from 'react'
import { ArrowRight, ChartNoAxesCombined, Hammer, Paperclip, Zap } from 'lucide-react'
import { UpdateReplanDialog } from './UpdateReplanDialog'
import type { ProgressOverview } from '../progressOverview'

export function UpdateReplanCard({ overview, completedProjects }: { overview: ProgressOverview; completedProjects: number }) {
  const [open, setOpen] = useState(false)
  const stats = [
    { label: 'Skills in profile', value: overview.skillsInProfile, icon: Zap, color: 'text-orange-500' },
    { label: 'Projects completed', value: completedProjects, icon: Hammer, color: 'text-amber-600' },
    { label: 'Evidence items', value: overview.evidenceItems, icon: Paperclip, color: 'text-slate-500' },
    { label: 'Market scan age', value: overview.marketScanAgeDays === null ? 'Unavailable' : `${overview.marketScanAgeDays} ${overview.marketScanAgeDays === 1 ? 'day' : 'days'}`, icon: ChartNoAxesCombined, color: 'text-violet-500' },
  ]

  return (
    <section aria-labelledby="update-replan-title" className="overflow-hidden rounded-3xl border border-blue-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <div>
          <h2 id="update-replan-title" className="text-lg font-bold text-slate-900">Update Profile &amp; Re-plan</h2>
          <p className="mt-1 text-sm text-slate-500">
            {overview.lastAnalysedAt ? <>Last analysed: <time dateTime={overview.lastAnalysedAt}>{new Date(overview.lastAnalysedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time> · {overview.profileChangedSinceAnalysis ? 'Profile or goal changed since analysis' : 'Profile and goal unchanged since analysis'}</> : 'Your roadmap has not been analysed yet.'}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-50">
          Update &amp; Re-plan <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 px-5 py-6 sm:grid-cols-4 sm:px-8">
        {stats.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl bg-slate-50 px-2 py-5 text-center">
          <Icon size={22} className={`mx-auto ${color}`} aria-hidden="true" />
          <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{label}</p>
        </div>)}
      </div>
      {open && <UpdateReplanDialog onClose={() => setOpen(false)} />}
    </section>
  )
}
