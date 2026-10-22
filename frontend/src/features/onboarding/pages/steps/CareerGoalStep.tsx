import { Clock3, Search, Sparkles } from 'lucide-react'
import { onboardingCopy } from '../../../../lib/constants'
import { goalCopy } from '../../../../lib/goalConstants'
import { PopularRoleChips } from '../../components/goal/PopularRoleChips'
import { RoleRecommendations } from '../../components/goal/RoleRecommendations'
import { RoleSearchBox } from '../../components/goal/RoleSearchBox'
import { PageHeader } from '../../components/layout/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { DeadlineSelector } from '../../components/goal/DeadlineSelector'
import { careerGoalSchema, type Deadline } from '../../types'

type CareerGoalStepProps = {
  targetRole: string
  deadline: Deadline
  customDeadlineDate: string
  onRoleChange: (role: string) => void
  onDeadlineChange: (deadline: Deadline) => void
  onCustomDeadlineDateChange: (date: string) => void
  showValidation?: boolean
  hasProfileInformation: boolean
}

export function CareerGoalStep({ targetRole, deadline, customDeadlineDate, onRoleChange, onDeadlineChange, onCustomDeadlineDateChange, showValidation = false, hasProfileInformation }: CareerGoalStepProps) {
  const validation = careerGoalSchema.safeParse({ targetRole, deadline, customDeadlineDate })
  const issues = showValidation && !validation.success ? validation.error.issues : []
  const roleError = issues.find((issue) => issue.path[0] === 'targetRole')?.message
  const dateError = issues.find((issue) => issue.path[0] === 'customDeadlineDate')?.message
  return (
    <div>
      <PageHeader {...onboardingCopy.headers[3]} />
      <div className="space-y-4">
        <SectionCard icon={Search} layout="stacked" title={goalCopy.search.title} description={goalCopy.search.description} invalid={Boolean(roleError)}>
          <div className="space-y-2">
            <RoleSearchBox value={targetRole} onChange={onRoleChange} onSelect={onRoleChange} error={roleError} />
            <PopularRoleChips selectedRole={targetRole} onSelect={onRoleChange} />
          </div>
        </SectionCard>
        <SectionCard icon={Sparkles} layout="stacked" title={goalCopy.recommendations.title} description={goalCopy.recommendations.description}>
          {({ titleId }) => hasProfileInformation
            ? <RoleRecommendations selectedRole={targetRole} onSelect={onRoleChange} labelledBy={titleId} />
            : <p className="py-6 text-sm text-muted-foreground">No profile information is available for career recommendations. Add your details or choose a career goal manually.</p>}
        </SectionCard>
        <SectionCard icon={Clock3} layout="stacked" title={goalCopy.deadline.title} description={goalCopy.deadline.description} invalid={Boolean(dateError)}>
          {({ titleId, descriptionId }) => <DeadlineSelector value={deadline} customDate={customDeadlineDate}
            validationError={dateError}
            onChange={onDeadlineChange} onCustomDateChange={onCustomDeadlineDateChange}
            labelledBy={titleId} describedBy={descriptionId} />}
        </SectionCard>
      </div>
    </div>
  )
}
