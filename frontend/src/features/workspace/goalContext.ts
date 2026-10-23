import type { CareerGoal } from '../roadmap/api-types'

const timeframeLabels: Record<CareerGoal['readinessTimeframe'], string> = {
  three_months: '3 months',
  six_months: '6 months',
  one_year: '1 year',
  no_fixed_deadline: 'No fixed deadline',
}

export function formatGoalContext(goal: CareerGoal | null | undefined): string {
  if (!goal) return 'Set your career goal'
  const role = goal.targetRoleTitle.trim()
  if (!role) return 'Set your career goal'
  const timeframe = goal.readinessTimeframe === 'no_fixed_deadline' && goal.targetDate
    ? `By ${goal.targetDate.slice(0, 10)}`
    : timeframeLabels[goal.readinessTimeframe]
  return [role, timeframe].filter(Boolean).join(' · ')
}
