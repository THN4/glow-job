import { CalendarDays, ChartNoAxesColumnIncreasing, Compass, Crosshair, FileText, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import type { OnboardingStep } from '../../types'
import type { SideFeature } from './SideFeatureItem'

export type SidebarContent = { headline: string; description: string; features: readonly SideFeature[] }
const defaultIcons: readonly LucideIcon[] = [FileText, ChartNoAxesColumnIncreasing, Compass]

export function getSidebarContent(step: OnboardingStep, analyzing = false): SidebarContent {
  const copy = step === 3 ? onboardingCopy.sidebar.goal
    : step === 4 ? onboardingCopy.sidebar.preferences
      : step === 5 ? onboardingCopy.sidebar.done : onboardingCopy.sidebar.upload
  const icons = step === 3 ? [Crosshair, ChartNoAxesColumnIncreasing, Compass]
    : step === 4 ? [CalendarDays, SlidersHorizontal, Compass] : defaultIcons
  return {
    headline: onboardingCopy.headline,
    description: analyzing ? onboardingCopy.sidebar.analyzing.description : copy.description,
    features: copy.features.map((feature, index) => ({ ...feature, icon: icons[index] })),
  }
}
