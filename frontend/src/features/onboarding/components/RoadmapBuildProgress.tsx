import { BarChart3, BriefcaseBusiness, Check, Database, FileText, GraduationCap, Lightbulb, LoaderCircle, Sparkles, Target } from 'lucide-react'
import type { RoadmapJob } from '../../roadmap/api-types'
import logo from '../../../assets/glow_job_icon.svg'

type RoadmapBuildProgressProps = {
  stage: RoadmapJob['stage'] | null
  goalSaved: boolean
}

const steps = [
  { title: 'Save your career goal', description: 'Saving your target role and preferences.' },
  { title: 'Prepare your learning context', description: 'Reviewing your profile, skill gaps, and learning content.' },
  { title: 'Build your personalized roadmap', description: 'Organizing skills and activities into your learning plan.' },
  { title: 'Save your roadmap', description: 'Validating your plan and saving it to your profile.' },
]

const illustrationNodes = [
  { x: 35, y: 100, color: '#60a5fa', Icon: FileText },
  { x: 145, y: 110, color: '#a78bfa', Icon: BarChart3 },
  { x: 245, y: 35, color: '#6acfb5', Icon: GraduationCap },
  { x: 365, y: 40, color: '#ff9865', Icon: BriefcaseBusiness },
]
const illustrationRoute = 'M35 100 C80 140 100 110 145 110 S205 35 245 35 S310 80 365 40'

export function RoadmapBuildProgress({ stage, goalSaved }: RoadmapBuildProgressProps) {
  const activeIndex = !goalSaved ? 0 : stage === 'done' ? 4 : stage === 'generating' ? 2 : stage === 'saving' ? 3 : 1
  const status = stage === 'queued' ? 'Waiting to start your roadmap…' : steps[activeIndex]?.title ?? 'Your roadmap is ready'

  return (
    <section className="roadmap-build" aria-label="Roadmap creation progress" aria-busy={stage !== 'done'}>
      <header className="flex items-start gap-3">
        <Sparkles className="mt-1 size-7 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Building your personalized roadmap</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">We’re reviewing your profile, finding relevant learning content, and creating a tailored plan for your career goal.</p>
        </div>
      </header>
      <div className="roadmap-build-layout mt-6">
        <div className="min-w-0">
          <div className="roadmap-build-scene" aria-hidden="true">
            <div className="roadmap-build-halo" />
            <div className="roadmap-build-board">
              <div className="flex items-center gap-3">
                <img src={logo} alt="" className="size-9" />
                <div className="flex-1 space-y-2"><div className="h-2 w-3/5 rounded-full bg-indigo-200" /><div className="h-2 w-1/3 rounded-full bg-indigo-100" /></div>
              </div>
              <svg viewBox="0 0 400 150" className="roadmap-build-path" fill="none">
                <path d={illustrationRoute} stroke="#dbeafe" strokeWidth="11" />
                <path className="roadmap-build-route" d={illustrationRoute} stroke="#8b9df6" strokeWidth="7" strokeLinecap="round" />
                {illustrationNodes.map(({ x, y, color, Icon }) => <g key={color}>
                  <circle cx={x} cy={y} r="21" fill={color} stroke="white" strokeWidth="3" />
                  <Icon x={x - 12} y={y - 12} width="24" height="24" color="white" />
                </g>)}
              </svg>
              <div className="absolute bottom-5 right-6 space-y-2 rounded-lg bg-indigo-100/70 p-3"><div className="h-1.5 w-20 rounded bg-white" /><div className="h-1.5 w-12 rounded bg-white/70" /></div>
            </div>
            <div className="roadmap-build-label roadmap-build-label-one"><BarChart3 className="bg-blue-100 text-blue-500" /><span>Analyzing<br />your skills</span></div>
            <div className="roadmap-build-label roadmap-build-label-two"><Target className="bg-rose-100 text-rose-500" /><span>Understanding<br />your career goal</span></div>
            <div className="roadmap-build-label roadmap-build-label-three"><Database className="bg-cyan-100 text-cyan-500" /><span>Finding<br />learning resources</span></div>
            <div className="roadmap-build-label roadmap-build-label-four"><Lightbulb className="bg-amber-100 text-amber-500" /><span>Creating<br />your roadmap</span></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-blue-50/90 p-4 sm:px-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary"><Sparkles className="size-6" aria-hidden="true" /></span>
            <div><p className="text-sm font-semibold text-foreground">A plan built around you</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your saved profile, career goal, and learning preferences guide each step of your roadmap.</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-white to-blue-50/60 p-5 sm:p-6">
          <p role="status" className="min-h-10 text-center text-sm font-semibold text-foreground">{status}</p>
          <div className="relative mx-auto mb-6 mt-1 flex size-24 items-center justify-center text-primary" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border-[6px] border-blue-100" />
            <span className="roadmap-build-orbit absolute inset-0 rounded-full border-[6px] border-transparent border-r-primary border-t-primary" />
            <Sparkles className="size-7" />
          </div>
          <ol>
            {steps.map((step, index) => {
              const complete = index < activeIndex
              const active = index === activeIndex
              return <li key={step.title} aria-current={active ? 'step' : undefined} className="relative flex gap-3 pb-5 last:pb-0">
                {index < steps.length - 1 && <span className={`absolute bottom-0 left-2.5 top-6 w-px ${complete ? 'bg-blue-500' : 'bg-blue-100'}`} aria-hidden="true" />}
                <span className={`relative mt-0.5 flex size-[21px] shrink-0 items-center justify-center rounded-full ${complete ? 'bg-primary text-white' : active ? 'bg-blue-100 text-primary ring-4 ring-blue-50' : 'bg-slate-100 text-slate-300'}`} aria-hidden="true">
                  {complete ? <Check className="size-3.5" strokeWidth={3} /> : active ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <span className="size-2.5 rounded-full bg-current" />}
                </span>
                <div><p className={`text-xs font-semibold leading-5 ${active ? 'text-primary' : 'text-foreground'}`}>{step.title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p></div>
              </li>
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
