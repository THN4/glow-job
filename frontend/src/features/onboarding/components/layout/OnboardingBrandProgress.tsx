import { Logo } from '../../../../components/shared/Logo'
import { sharedCopy } from '../../../../lib/constants'
import { cn } from '../../../../lib/utils'
import type { OnboardingStep } from '../../types'
import { SideProgress } from './SideProgress'

type OnboardingBrandProgressProps = {
  currentStep: OnboardingStep
  completedSteps?: readonly OnboardingStep[]
  progressLabel?: string
  analyzing?: boolean
  compact?: boolean
}

export function OnboardingBrandProgress({ currentStep, completedSteps, progressLabel, analyzing = false, compact = false }: OnboardingBrandProgressProps) {
  return <div className={cn('min-w-0', compact && 'w-28 sm:w-40')}>
    <div className="flex items-center">
      <Logo className={compact ? 'w-7 [&>img]:size-7 sm:w-8 sm:[&>img]:size-8' : 'w-24'} />
      <span aria-hidden="true" className={cn('font-bold leading-tight tracking-tight', compact ? 'ml-1 text-sm sm:text-base' : 'text-2xl')}>
        {sharedCopy.brandGlow}<span className="text-primary">{sharedCopy.brandJob}</span>
      </span>
    </div>
    <div className={compact ? 'mt-1' : 'mt-3'}>
      <SideProgress currentStep={currentStep} completedSteps={completedSteps} label={progressLabel} analyzing={analyzing} compact={compact} />
    </div>
  </div>
}
