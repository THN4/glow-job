import { workspaceStyles } from '../../workspace/workspaceStyles'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { learningStatusIcons } from '../../../components/statusIcons'
import { useState } from 'react'
import { ArrowRight, ChartNoAxesCombined, Paperclip, Zap } from 'lucide-react'
import { UpdateReplanDialog } from './UpdateReplanDialog'
import type { ProgressOverview } from '../progressOverview'

export function UpdateReplanCard({ overview, completedProjects }: { overview: ProgressOverview; completedProjects: number }) {
  const [open, setOpen] = useState(false)
  const stats = [
    { label: 'Skills in profile', value: overview.skillsInProfile, icon: Zap, tone: 'warning' as const },
    { label: 'Projects completed', value: completedProjects, icon: learningStatusIcons.completed, tone: 'success' as const },
    { label: 'Evidence items', value: overview.evidenceItems, icon: Paperclip, tone: 'muted' as const },
    { label: 'Market scan age', value: overview.marketScanAgeDays === null ? 'Unavailable' : `${overview.marketScanAgeDays} ${overview.marketScanAgeDays === 1 ? 'day' : 'days'}`, icon: ChartNoAxesCombined, tone: 'info' as const },
  ]

  return (
    <section aria-labelledby="update-replan-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <h2 id="update-replan-title" className={workspaceStyles.sectionTitle}>Update Profile &amp; Re-plan</h2>
          <p className="mt-1 text-sm text-slate-500">
            {overview.lastAnalysedAt ? <>Last analysed: <time dateTime={overview.lastAnalysedAt}>{new Date(overview.lastAnalysedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time> · {overview.profileChangedSinceAnalysis ? 'Profile or goal changed since analysis' : 'Profile and goal unchanged since analysis'}</> : 'Your roadmap has not been analysed yet.'}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
          className={workspaceStyles.outlineAction}>
          Update &amp; Re-plan <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="border-t border-border p-4">
        <StatGrid label="Profile summary statistics">
          {stats.map(({ label, value, icon, tone }) => <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />)}
        </StatGrid>
      </div>
      {open && <UpdateReplanDialog onClose={() => setOpen(false)} />}
    </section>
  )
}
