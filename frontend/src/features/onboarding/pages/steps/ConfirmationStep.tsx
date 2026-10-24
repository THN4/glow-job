import { useEffect, useRef } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '../../../../components/ui/button'

type ConfirmationStepProps = {
  ready: boolean
  error: string | null
  goalSaved: boolean
  onContinue: () => void
  onBack: () => void
}

export function ConfirmationStep({ ready, error, goalSaved, onContinue, onBack }: ConfirmationStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [ready])

  return <section className="flex flex-1 flex-col">
    <header>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-foreground outline-none sm:text-3xl">{error ? 'Let’s try that again' : 'You’re all set'}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
        {ready ? <>We’ve prepared your personalized roadmap.<br />You can explore the full details inside your dashboard.</>
          : <>Your profile and learning preferences are ready.<br />Create your personalized roadmap and take your next step.</>}
      </p>
    </header>
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-8 sm:py-12">
      <div className="relative isolate overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 px-5 pb-6 pt-7 text-center sm:px-8">
        <svg className="pointer-events-none absolute inset-0 -z-10 size-full" viewBox="0 0 470 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M52 157C18 109 133 61 211 31S358 76 408 121S459 231 350 235S84 211 52 157Z" fill="#e6f4ff" />
          <path d="M21 175C21 154 49 143 70 145C76 102 125 100 134 141C172 147 165 184 128 186H49C32 186 21 183 21 175Z" fill="#f5fbff" />
          <path d="M302 170C277 154 291 133 310 130C315 98 358 97 368 130C406 131 418 173 370 182H321Z" fill="#f5fbff" />
        </svg>
        <div className="relative mx-auto mb-5 flex size-24 items-center justify-center rounded-full bg-white/75 sm:size-28" aria-hidden="true">
          <Check className="size-14 text-primary sm:size-16" strokeWidth={4} />
          <span className="absolute -right-7 top-1 text-4xl text-blue-500">✦</span>
          <span className="absolute -right-1 -top-5 text-2xl text-blue-400">✦</span>
          <span className="absolute -left-6 bottom-0 text-2xl text-blue-400">✦</span>
        </div>
        <h2 className="text-lg font-bold text-foreground sm:text-xl">{ready ? 'Your roadmap is ready' : 'Ready for your next chapter'}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-muted-foreground">
          {ready ? 'Go to your dashboard to explore your personalized career roadmap and next steps.' : 'Turn your career goal into a learning plan tailored to your skills and preferences.'}
        </p>
      </div>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
        <p>{error}</p>
        {goalSaved && <p className="mt-2 text-xs">Your career goal and preferences are saved. You can retry creating your roadmap.</p>}
      </div>}
      <div className="mx-auto mt-3 flex w-full max-w-xs flex-col gap-3">
        <Button type="button" onClick={onContinue} className="h-11 w-full gap-2 font-semibold">
          {ready ? 'View my roadmap' : error ? 'Try again' : 'Build my roadmap'}<ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button type="button" onClick={onBack} variant="outline" className="h-11 w-full border-blue-200 bg-white text-primary">Back</Button>
      </div>
    </div>
  </section>
}
