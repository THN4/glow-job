import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { onboardingCopy } from '../../../../lib/constants'

type StepNavigationProps = {
  onBack?: () => void
  onContinue: () => void
  canContinue?: boolean
  isLoading?: boolean
  continueLabel?: string
  backLabel?: string
  extraActions?: ReactNode
  continueIcon?: LucideIcon
}

export function StepNavigation({
  onBack,
  onContinue,
  canContinue = true,
  isLoading = false,
  continueLabel = onboardingCopy.continue,
  backLabel = onboardingCopy.back,
  extraActions,
  continueIcon: ContinueIcon,
}: StepNavigationProps) {
  return (
    <footer className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 @min-[34rem]:grid-cols-[auto_minmax(0,1fr)_auto]">
      {extraActions && <div className="col-span-2 col-start-1 row-start-1 flex justify-end @min-[34rem]:col-span-1 @min-[34rem]:col-start-2">{extraActions}</div>}
      {onBack ? (
        <Button
          variant="outline"
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className={cn('col-start-1 h-12 gap-2 border-input bg-card px-5 text-base text-primary',
            extraActions ? 'row-start-2 @min-[34rem]:row-start-1' : 'row-start-1')}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Button>
      ) : (
        <span className="col-start-1 row-start-1" />
      )}

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || isLoading}
        className={cn('col-start-2 h-12 min-w-0 gap-2 whitespace-normal px-3 text-sm font-semibold sm:text-base @min-[34rem]:col-start-3 @min-[34rem]:min-w-60 @min-[34rem]:gap-3 @min-[34rem]:justify-self-end @min-[34rem]:px-6',
          extraActions ? 'row-start-2 @min-[34rem]:row-start-1' : 'row-start-1')}
      >
        {isLoading && (
          <LoaderCircle
            size={16}
            className="animate-spin"
            aria-hidden="true"
          />
        )}
        {!isLoading && ContinueIcon && <ContinueIcon className="size-5 shrink-0" aria-hidden="true" />}
        <span className="min-w-0 leading-5">{continueLabel}</span>
        {!isLoading && !ContinueIcon && <ArrowRight size={16} aria-hidden="true" />}
      </Button>
    </footer>
  )
}
