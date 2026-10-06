import { Clock3, Search, Sparkles } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { goalCopy } from '../../../../lib/goalConstants'
import { PopularRoleChips } from '../../components/goal/PopularRoleChips'
import { RoleRecommendations } from '../../components/goal/RoleRecommendations'
import { RoleSearchBox } from '../../components/goal/RoleSearchBox'
import { PageHeader } from '../../components/layout/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { SelectGroup } from '../../components/SelectGroup'
import type { Deadline } from '../../types'

type CareerGoalStepProps = {
  targetRole: string
  deadline: Deadline
  onRoleChange: (role: string) => void
  onDeadlineChange: (deadline: Deadline) => void
}

export function CareerGoalStep({ targetRole, deadline, onRoleChange, onDeadlineChange }: CareerGoalStepProps) {
  return (
    <div>
      <PageHeader {...onboardingCopy.headers[3]} className="mb-3.5 sm:mb-3.5" />
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
          {({ titleId, descriptionId }) => <SelectGroup<Deadline> value={deadline} onChange={onDeadlineChange}
            options={goalCopy.deadline.options} labelledBy={titleId} describedBy={descriptionId} cardVariant="inline-radio"
            className="grid-cols-1 min-[480px]:grid-cols-2 2xl:grid-cols-4" />}
        </SectionCard>
      </div>
    </div>
  )
}
