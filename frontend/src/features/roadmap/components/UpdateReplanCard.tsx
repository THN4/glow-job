import { workspaceStyles } from '../../workspace/workspaceStyles'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { learningStatusIcons } from '../../../components/statusIcons'
import { useId, useRef, useState } from 'react'
import { ChartNoAxesCombined, ChevronDown, Paperclip, Zap } from 'lucide-react'
import { UpdateReplanForm } from './UpdateReplanForm'
import type { ProgressOverview } from '../progressOverview'

export function UpdateReplanCard({ overview, completedProjects }: { overview: ProgressOverview; completedProjects: number }) {
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const [working, setWorking] = useState(false)
  const formId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  function closeForm() {
    setOpen(false)
    setOpened(false)
    window.requestAnimationFrame(() => toggleRef.current?.focus())
  }
  const stats = [
    { label: 'Skills in profile', value: overview.skillsInProfile, icon: Zap, tone: 'warning' as const },
    { label: 'Projects completed', value: completedProjects, icon: learningStatusIcons.completed, tone: 'success' as const },
    { label: 'Evidence items', value: overview.evidenceItems, icon: Paperclip, tone: 'muted' as const },
    { label: 'Market scan age', value: overview.marketScanAgeDays === null ? 'Unavailable' : `${overview.marketScanAgeDays} ${overview.marketScanAgeDays === 1 ? 'day' : 'days'}`, icon: ChartNoAxesCombined, tone: 'info' as const },
  ]

  return (
    <section aria-labelledby="update-replan-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 id="update-replan-title" className={workspaceStyles.sectionTitle}>Update Profile &amp; Re-plan</h2>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground sm:text-sm">
            {overview.lastAnalysedAt ? <>Last analysed: <time dateTime={overview.lastAnalysedAt}>{new Date(overview.lastAnalysedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time> · {overview.profileChangedSinceAnalysis ? 'Profile or goal changed since analysis' : 'Profile and goal unchanged since analysis'}</> : 'Your roadmap has not been analysed yet.'}
          </p>
        </div>
        <button ref={toggleRef} type="button" onClick={() => { setOpened(true); setOpen(!open) }} disabled={working} aria-controls={formId} aria-expanded={open}
          className={workspaceStyles.outlineAction}>
          {open ? 'Hide updates' : 'Update & Re-plan'} <ChevronDown size={16} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div id={formId} hidden={!open} className="border-t border-border p-4 sm:p-5">
        {opened && <UpdateReplanForm onClose={closeForm} onWorkingChange={setWorking} />}
      </div>
      <div className="border-t border-border p-4">
        <StatGrid label="Profile summary statistics" mobileColumns={2}>
          {stats.map(({ label, value, icon, tone }) => <StatCard key={label} compactOnMobile label={label} value={value} icon={icon} tone={tone} />)}
        </StatGrid>
      </div>
    </section>
  )
}
