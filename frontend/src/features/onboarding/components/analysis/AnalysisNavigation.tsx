import { Button } from '../../../../components/ui/button'
import { analysisCopy } from '../../../../lib/analysisConstants'
import { StepNavigation } from '../layout/StepNavigation'

type AnalysisNavigationProps = {
  failed: boolean
  ready: boolean
  onCancel: () => void
  onRetry: () => void
  onManual: () => void
  onContinue: () => void
}

export function AnalysisNavigation({ failed, ready, onCancel, onRetry, onManual, onContinue }: AnalysisNavigationProps) {
  if (failed) return <StepNavigation onBack={onCancel} onContinue={onRetry}
    backLabel={analysisCopy.cancel} continueLabel={analysisCopy.retry}
    extraActions={<Button type="button" variant="link" onClick={onManual}>{analysisCopy.manual}</Button>} />
  if (ready) return <StepNavigation onBack={onCancel} onContinue={onContinue} />
  return null
}
