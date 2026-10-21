import { ArrowRight, BriefcaseBusiness, Code2, GraduationCap, NotebookText, Sparkles, UserRound } from 'lucide-react'
import { IconBox } from '../../../../components/shared/IconBox'
import { analysisCopy } from '../../../../lib/analysisConstants'

const rows = [
  { label: analysisCopy.illustration.education, icon: GraduationCap, color: 'green' },
  { label: analysisCopy.illustration.skills, icon: Code2, color: 'purple' },
  { label: analysisCopy.illustration.experience, icon: BriefcaseBusiness, color: 'blue' },
  { label: analysisCopy.illustration.projects, icon: NotebookText, color: 'pink' },
] as const

export function CvProfileIllustration() {
  return <div aria-hidden="true" className="relative mx-auto flex aspect-[1.3] w-full max-w-112 items-center justify-center gap-3 p-3 sm:gap-5">
    <div className="absolute inset-3 rounded-[45%_55%_38%_62%] bg-accent" />
    <div className="relative w-[30%] -rotate-4 rounded-xl border border-border bg-card p-2.5 shadow-sm">
      <div className="rounded-lg bg-panel px-3 py-5">
        <span className="text-lg font-bold text-muted-foreground">{analysisCopy.illustration.cv}</span>
        <div className="mt-3 space-y-1.5">{[90, 65, 100, 95, 80, 60, 75].map((width, index) =>
          <div key={index} className="h-1.5 rounded-full bg-input/70" style={{ width: `${width}%` }} />)}</div>
      </div>
    </div>
    <ArrowRight className="relative size-9 shrink-0 -rotate-12 text-primary sm:size-12" strokeWidth={2} />
    <div className="relative w-[47%] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-icon-blue text-primary/60"><UserRound className="size-6" /></span>
        <div className="w-full space-y-1.5"><div className="h-1.5 w-4/5 rounded-full bg-primary/45" /><div className="h-1.5 w-3/5 rounded-full bg-input" /></div>
      </div>
      <div className="space-y-3 p-3">{rows.map(({ label, icon, color }) => <div key={label} className="flex items-center gap-2">
        <IconBox icon={icon} color={color} className="size-8 rounded-lg [&>svg]:size-5" />
        <div className="min-w-0 flex-1"><span className="text-[10px] font-semibold text-foreground">{label}</span>
          <div className="mt-1 h-1.5 rounded-full bg-input/70" /><div className="mt-1 h-1.5 w-3/5 rounded-full bg-input/70" /></div>
      </div>)}</div>
    </div>
    <Sparkles className="absolute right-2 top-1 size-8 text-primary/75" />
  </div>
}
