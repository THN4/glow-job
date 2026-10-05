import {
  ChartNoAxesColumnIncreasing,
  Compass,
  FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OnboardingStep } from '../../types'
import backgroundImage from '../../../../assets/images/glowjob-background.png'
import logoImage from '../../../../assets/images/GlowJob.png'

type OnboardingSidebarProps = {
  currentStep: OnboardingStep
}

const benefits: {
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    icon: FileText,
    title: 'AI-powered insights',
    description: 'We analyze your CV to uncover your unique strengths.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: 'Personalized guidance',
    description: 'Get tailored career advice and next steps.',
  },
  {
    icon: Compass,
    title: 'A clearer path forward',
    description: 'Set goals and discover new opportunities.',
  },
]

export function OnboardingSidebar({
  currentStep,
}: OnboardingSidebarProps) {
  return (
    <aside className="relative hidden min-h-screen w-[266px] shrink-0 flex-col overflow-hidden bg-[#edf6ff] px-6 py-5 lg:flex">
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full object-contain object-bottom"
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <img
            src={logoImage}
            alt="Glow-Job"
            className="h-12 w-[68px] object-contain"
          />
          <span className="text-[11px] text-blue-700">
            Your AI career co-pilot
          </span>
        </div>

        <p className="mt-2 text-xs font-medium text-slate-800">
          Step {currentStep} of 5
        </p>

        <div
          className="mt-2 flex gap-1.5"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={currentStep}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index < currentStep ? 'bg-blue-600' : 'bg-blue-200'
              }`}
            />
          ))}
        </div>

        <h1 className="mt-8 text-[28px] font-bold leading-[1.1] text-slate-900">
          Your brighter
          <br />
          career journey
          <br />
          starts here
        </h1>

        <p className="mt-3 text-sm leading-5 text-blue-800">
          Upload your CV so our AI can understand your background and give you
          personalized guidance for what’s next.
        </p>

        <div className="mt-5 space-y-4">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Icon size={18} aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-xs font-bold text-slate-900">{title}</h2>
                <p className="mt-0.5 text-[11px] leading-4 text-blue-800">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}