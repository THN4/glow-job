import { CircleCheck, Clock3, Info } from 'lucide-react'
import { analysisCopy } from '../../../../lib/analysisConstants'
import type { AnalysisStep } from '../../analysisTypes'
import { AnalysisSteps } from '../../components/analysis/AnalysisSteps'
import { CvProfileIllustration } from '../../components/analysis/CvProfileIllustration'
import { PageHeader } from '../../components/layout/PageHeader'

export function AnalyzingCvStep({ steps, error, ready }: { steps: readonly AnalysisStep[]; error: string | null; ready: boolean }) {
  const completed = steps.filter((step) => step.status === 'done').length
  const activeTask = steps.find((step) => step.status === 'loading')
  const activeTitle = analysisCopy.steps.find((step) => step.id === activeTask?.id)?.title
  return <div>
    <PageHeader {...(ready ? analysisCopy.readyHeader : analysisCopy.header)} />
    <p className="mb-4 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
      <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />{analysisCopy.demoNotice}
    </p>
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {error ? analysisCopy.errorTitle : ready ? analysisCopy.readyHeader.subtitle : `${analysisCopy.completed(completed, steps.length)}. ${activeTitle ?? ''}`}
    </p>
    <div aria-busy={!error && !ready} className="grid grid-cols-1 items-center gap-6 rounded-lg border border-border bg-panel p-4 sm:p-5 xl:grid-cols-2 xl:gap-8">
      <AnalysisSteps steps={steps} />
      <div className="hidden min-w-0 border-t border-border pt-5 sm:block xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6"><CvProfileIllustration /></div>
    </div>
    {error ? <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-panel p-4 sm:p-5">
      <h2 className="text-base font-semibold text-destructive">{analysisCopy.errorTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{error}</p>
    </div> : <div className="mt-4 flex items-start gap-4 rounded-lg border border-border bg-panel p-4 sm:p-5">
      {ready ? <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" strokeWidth={1.6} aria-hidden="true" />
        : <Clock3 className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" />}
      <div><h2 className="text-base font-semibold text-primary">{ready ? analysisCopy.readyTitle : analysisCopy.timingTitle}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{ready ? analysisCopy.readyDescription : analysisCopy.timingDescription}</p></div>
    </div>}
  </div>
}
