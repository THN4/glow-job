import { Check, CircleAlert, Code2, FileText, GraduationCap, BriefcaseBusiness, LoaderCircle, Star } from 'lucide-react'
import { IconBox } from '../../../../components/shared/IconBox'
import { analysisCopy } from '../../../../lib/analysisConstants'
import { cn } from '../../../../lib/utils'
import type { AnalysisStep, AnalysisTask } from '../../analysisTypes'

const icons = { reading: FileText, skills: Code2, education: GraduationCap, experience: BriefcaseBusiness, profile: Star }
const colors = { reading: 'blue', skills: 'purple', education: 'green', experience: 'blue', profile: 'blue' } as const

export function AnalysisSteps({ steps }: { steps: readonly AnalysisStep[] }) {
  return <ol className="min-w-0 space-y-5 sm:space-y-6">
    {analysisCopy.steps.map((task, index) => {
      const status = steps.find((step) => step.id === task.id)?.status ?? 'pending'
      return <li key={task.id} data-task={task.id} data-status={status} className="relative flex items-start gap-3 sm:gap-4">
        {index < analysisCopy.steps.length - 1 && <span aria-hidden="true" className={cn('absolute left-3.5 top-9 h-[calc(100%-0.5rem)] w-0.5 bg-border', status === 'done' && 'bg-success/30')} />}
        <TaskStatus status={status} task={task.id} />
        <IconBox icon={icons[task.id]} color={colors[task.id]} className="size-10 sm:size-11" />
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold leading-5 text-foreground sm:text-base">{task.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{task.description}</p>
        </div>
      </li>
    })}
  </ol>
}

function TaskStatus({ status, task }: { status: AnalysisStep['status']; task: AnalysisTask }) {
  return <span role="img" aria-label={`${analysisCopy.steps.find((step) => step.id === task)?.title}: ${analysisCopy.status[status]}`}
    className={cn('relative z-10 mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-4 ring-panel',
      status === 'done' && 'bg-success text-primary-foreground', status === 'loading' && 'bg-panel text-primary',
      status === 'error' && 'bg-panel text-destructive')}>
    {status === 'done' && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
    {status === 'loading' && <LoaderCircle className="size-7 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    {status === 'error' && <CircleAlert className="size-6" aria-hidden="true" />}
  </span>
}
