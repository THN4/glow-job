import { workspaceStyles } from '../../workspace/workspaceStyles'
import { learningStatusIcons } from '../../../components/statusIcons'
import { ClipboardCheck, Paperclip, Target, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ProgressActivity } from '../progressOverview'

const appearance = {
  goal: { icon: Target, color: 'border-violet-200 bg-violet-50 text-violet-600' },
  replan: { icon: WandSparkles, color: 'border-blue-200 bg-blue-50 text-blue-600' },
  completed: { icon: learningStatusIcons.completed, color: 'border-emerald-200 bg-emerald-50 text-emerald-600' },
  evidence: { icon: Paperclip, color: 'border-amber-200 bg-amber-50 text-amber-600' },
  assessment: { icon: ClipboardCheck, color: 'border-emerald-200 bg-emerald-50 text-emerald-600' },
}

export function RecentActivity({ activities, roadmapId }: { activities: ProgressActivity[]; roadmapId: number | null }) {
  return (
    <section aria-labelledby="recent-activity-title" className="recent-activity-timeline min-w-0 rounded-xl bg-blue-50/60 p-4 sm:p-6">
      <h2 id="recent-activity-title" className={workspaceStyles.sectionTitle}>Recent activity</h2>
      {!activities.length ? <p className="mt-4 text-sm text-slate-600">No saved activity yet.</p> : <ol className="mt-6">
        {activities.map((activity, index) => {
          const { icon: Icon, color } = appearance[activity.kind]
          const currentStep = activity.nodeKey && activity.roadmapId === roadmapId
          return <li key={activity.id} className="recent-activity-item flex gap-3 sm:gap-4">
            <div className="flex w-8 shrink-0 flex-col items-center sm:w-11">
              <span className={`recent-activity-circle z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 sm:size-11 ${color}`}><Icon className="size-4 sm:size-5" aria-hidden="true" /></span>
              {index < activities.length - 1 && <span className="recent-activity-line min-h-6 w-0.5 flex-1 bg-blue-100" aria-hidden="true" />}
            </div>
            <div className={`min-w-0 flex-1 break-words pt-1 [overflow-wrap:anywhere] sm:pt-2 ${index < activities.length - 1 ? 'pb-6' : ''}`}>
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                {currentStep ? <Link to={`/app/roadmap?node=${encodeURIComponent(activity.nodeKey!)}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline">{activity.title}</Link> : <h3 className="text-sm font-semibold text-slate-900">{activity.title}</h3>}
                <time dateTime={activity.occurredAt} title={new Date(activity.occurredAt).toLocaleString()} className="text-xs text-slate-500">{new Date(activity.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-slate-500">{activity.description}</p>
            </div>
          </li>
        })}
      </ol>}
    </section>
  )
}
