import { useId } from 'react'
import { Clock3, Sparkles } from 'lucide-react'
import { goalCopy } from '../../../../lib/goalConstants'
import { IconBox } from '../../../../components/shared/IconBox'
import { PopularRoleChips } from '../../components/goal/PopularRoleChips'
import { RoleRecommendations } from '../../components/goal/RoleRecommendations'
import { RoleSearchBox } from '../../components/goal/RoleSearchBox'
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
  supportedRoles?: string[]
}

export function CareerGoalStep({ targetRole, deadline, customDeadlineDate, onRoleChange, onDeadlineChange, onCustomDeadlineDateChange, showValidation = false, hasProfileInformation, supportedRoles = [] }: CareerGoalStepProps) {
  const titleId = useId()
  const recommendationsId = useId()
  const searchTitleId = useId()
  const deadlineTitleId = useId()
  const deadlineDescriptionId = useId()
  const validation = careerGoalSchema.safeParse({ targetRole, deadline, customDeadlineDate })
  const issues = showValidation && !validation.success ? validation.error.issues : []
  const roleError = issues.find((issue) => issue.path[0] === 'targetRole')?.message
  const dateError = issues.find((issue) => issue.path[0] === 'customDeadlineDate')?.message

  return (
    <div className="space-y-4">
      <section aria-labelledby={titleId} data-invalid={Boolean(roleError) || undefined}
        className="scroll-mt-6 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-background to-sky-50/60 p-4 shadow-sm outline-none sm:p-6">
        <header className="mb-6 flex items-center gap-4">
          <IconBox icon={Sparkles} className="size-13 rounded-xl" />
          <div className="min-w-0">
            <h1 id={titleId} tabIndex={-1} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Find Your Target Role</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Explore personalized career recommendations or search for a role yourself.</p>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={recommendationsId} className="text-lg font-semibold text-foreground">Recommended for You</h2>
            <p className="mt-1 text-sm text-muted-foreground">Based on your CV and existing skills</p>
          </div>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-icon-blue px-3 text-sm font-medium text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> AI Powered
          </span>
        </div>
        {hasProfileInformation
          ? <RoleRecommendations selectedRole={targetRole} onSelect={onRoleChange} labelledBy={recommendationsId} />
          : <p className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-muted-foreground">No profile information is available for career recommendations. Add your details or choose a career goal manually.</p>}

        <div className="my-6 flex items-center gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span>Or search for your own role</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div>
          <h2 id={searchTitleId} className="mb-2 text-lg font-semibold text-foreground">Already have a role in mind?</h2>
          <RoleSearchBox value={targetRole} onChange={onRoleChange} onSelect={onRoleChange} error={roleError} />
          {supportedRoles.length > 0 && <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Roadmaps available now</p>
            <div className="flex flex-wrap gap-2">
              {supportedRoles.map((role) => <button key={role} type="button" onClick={() => onRoleChange(role)}
                aria-pressed={targetRole.trim().toLocaleLowerCase() === role.toLocaleLowerCase()}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white">
                {role}
              </button>)}
            </div>
          </div>}
          <div className="mt-2">
            <PopularRoleChips selectedRole={targetRole} onSelect={onRoleChange} />
          </div>
        </div>
      </section>

      <section tabIndex={-1} data-invalid={Boolean(dateError) || undefined} aria-labelledby={deadlineTitleId}
        className="grid min-h-28 scroll-mt-6 items-center gap-4 rounded-lg border border-border bg-panel p-4 outline-none sm:p-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex items-start gap-4 xl:gap-7">
          <IconBox icon={Clock3} />
          <div className="min-w-0">
            <h2 id={deadlineTitleId} className="text-base font-semibold leading-6 text-foreground sm:text-lg">{goalCopy.deadline.title}</h2>
            <p id={deadlineDescriptionId} className="mt-1.5 text-sm leading-5 text-muted-foreground">{goalCopy.deadline.description}</p>
          </div>
        </div>
        <div className="min-w-0">
          <DeadlineSelector value={deadline} customDate={customDeadlineDate}
            validationError={dateError} onChange={onDeadlineChange}
            onCustomDateChange={onCustomDeadlineDateChange}
            labelledBy={deadlineTitleId} describedBy={deadlineDescriptionId} />
        </div>
      </section>
    </div>
  )
}
