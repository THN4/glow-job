import { Clock3, Search, Sparkles } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { goalCopy } from '../../../../lib/goalConstants'
import { PopularRoleChips } from '../../components/goal/PopularRoleChips'
import { RoleRecommendations } from '../../components/goal/RoleRecommendations'
import { RoleSearchBox } from '../../components/goal/RoleSearchBox'
import { PageHeader } from '../../components/layout/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { DeadlineSelector } from '../../components/goal/DeadlineSelector'
import type { Deadline } from '../../types'

type CareerGoalStepProps = {
  targetRole: string
  deadline: Deadline
  customDeadlineDate: string
  onRoleChange: (role: string) => void
  onDeadlineChange: (deadline: Deadline) => void
  onCustomDeadlineDateChange: (date: string) => void
}

export function CareerGoalStep({ targetRole, deadline, customDeadlineDate, onRoleChange, onDeadlineChange, onCustomDeadlineDateChange }: CareerGoalStepProps) {
  return (
    <div>
      <PageHeader {...onboardingCopy.headers[3]} />
      <div className="space-y-4">
        <SectionCard icon={Search} layout="stacked" title={goalCopy.search.title} description={goalCopy.search.description}>
          <div className="space-y-2">
            <RoleSearchBox value={targetRole} onChange={onRoleChange} onSelect={onRoleChange} />
            <PopularRoleChips selectedRole={targetRole} onSelect={onRoleChange} />
          </div>
        </SectionCard>
        <SectionCard icon={Sparkles} layout="stacked" title={goalCopy.recommendations.title} description={goalCopy.recommendations.description}>
          {({ titleId }) => <RoleRecommendations selectedRole={targetRole} onSelect={onRoleChange} labelledBy={titleId} />}
        </SectionCard>
        <SectionCard icon={Clock3} layout="stacked" title={goalCopy.deadline.title} description={goalCopy.deadline.description}>
          {({ titleId, descriptionId }) => <DeadlineSelector value={deadline} customDate={customDeadlineDate}
            onChange={onDeadlineChange} onCustomDateChange={onCustomDeadlineDateChange}
            labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
      </div>
    </div>
  )
}
