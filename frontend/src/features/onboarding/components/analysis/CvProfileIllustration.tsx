import { ArrowRight, BriefcaseBusiness, Code2, GraduationCap, NotebookText, Sparkles, UserRound } from 'lucide-react'
import { IconBox } from '../../../../components/shared/IconBox'
import { analysisCopy } from '../../../../lib/analysisConstants'

const rows = [
  { label: analysisCopy.illustration.education, icon: GraduationCap, color: 'green' },
  { label: analysisCopy.illustration.skills, icon: Code2, color: 'purple' },
  { label: analysisCopy.illustration.experience, icon: BriefcaseBusiness, color: 'blue' },
  { label: analysisCopy.illustration.projects, icon: NotebookText, color: 'pink' },
] as const

export function CvProfileIllustration({ state = 'running' }: { state?: 'running' | 'ready' | 'error' }) {
  return <div aria-hidden="true" data-state={state} className="cv-analysis-visual relative mx-auto flex aspect-[1.3] w-full max-w-112 items-center justify-center gap-3 p-3 sm:gap-5">
    <div className="cv-analysis-halo absolute inset-3 rounded-[45%_55%_38%_62%] bg-accent" />
    <div className="cv-analysis-document relative w-[30%] -rotate-4 rounded-xl border border-border bg-card p-2.5 shadow-sm">
      <div className="relative overflow-hidden rounded-lg bg-panel px-3 py-5">
        <span className="text-lg font-bold text-muted-foreground">{analysisCopy.illustration.cv}</span>
        <div className="mt-3 space-y-1.5">{[90, 65, 100, 95, 80, 60, 75].map((width, index) =>
          <div key={index} className="h-1.5 rounded-full bg-input/70" style={{ width: `${width}%` }} />)}</div>
        <span className="cv-analysis-scan absolute inset-x-0 top-0 h-8" />
      </div>
    </div>
    <span className="relative size-9 shrink-0 -rotate-12 text-primary sm:size-12">
      <ArrowRight className="size-full" strokeWidth={2} />
      <span className="cv-analysis-transfer absolute left-0 top-1/2 size-1.5 rounded-full bg-sky-300" />
    </span>
    <div className="cv-analysis-profile relative w-[47%] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-icon-blue text-primary/60"><UserRound className="size-6" /></span>
        <div className="w-full space-y-1.5"><div className="h-1.5 w-4/5 rounded-full bg-primary/45" /><div className="h-1.5 w-3/5 rounded-full bg-input" /></div>
      </div>
      <div className="space-y-3 p-3">{rows.map(({ label, icon, color }, index) => <div key={label} className="cv-analysis-row relative flex items-center gap-2 overflow-hidden rounded-lg" style={{ animationDelay: `${index * 0.45}s` }}>
        <IconBox icon={icon} color={color} className="size-8 rounded-lg [&>svg]:size-5" />
        <div className="min-w-0 flex-1"><span className="text-[10px] font-semibold text-foreground">{label}</span>
          <div className="mt-1 h-1.5 rounded-full bg-input/70" /><div className="mt-1 h-1.5 w-3/5 rounded-full bg-input/70" /></div>
      </div>)}</div>
    </div>
    <Sparkles className="cv-analysis-sparkle absolute right-2 top-1 size-8 text-primary/75" />
  </div>
}
