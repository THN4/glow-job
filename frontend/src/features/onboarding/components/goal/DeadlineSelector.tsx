import { useId } from 'react'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { getMinimumDeadlineDate } from '../../../../lib/deadline'
import { goalCopy } from '../../../../lib/goalConstants'
import { customDeadlineDateSchema, type Deadline } from '../../types'
import { SelectGroup } from '../SelectGroup'

type DeadlineSelectorProps = {
  value: Deadline
  customDate: string
  onChange: (value: Deadline) => void
  onCustomDateChange: (date: string) => void
  labelledBy: string
  describedBy: string
  validationError?: string
}

export function DeadlineSelector({ value, customDate, onChange, onCustomDateChange, labelledBy, describedBy, validationError }: DeadlineSelectorProps) {
  const inputId = useId()
  const hintId = useId()
  const validation = customDeadlineDateSchema.safeParse(customDate)
  const error = validationError ?? (customDate && !validation.success ? validation.error.issues[0].message : null)

  return <div className="space-y-3">
    <SelectGroup<Deadline> value={value} onChange={onChange} options={goalCopy.deadline.options}
      labelledBy={labelledBy} describedBy={describedBy} cardVariant="inline-radio"
      className="grid-cols-1 min-[480px]:grid-cols-2 2xl:grid-cols-4" />
    {value === 'custom' && <div className="max-w-sm space-y-2">
      <Label htmlFor={inputId}>{goalCopy.deadline.dateLabel}</Label>
      <Input id={inputId} type="date" value={customDate} min={getMinimumDeadlineDate()} required
        data-onboarding-field="customDeadlineDate"
        onChange={(event) => onCustomDateChange(event.target.value)} aria-invalid={Boolean(error)}
        aria-describedby={hintId} className="h-11 min-w-0 border-input bg-card text-base md:text-base" />
      <p id={hintId} role={error ? 'alert' : undefined} className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
        {error ?? goalCopy.deadline.dateHint}
      </p>
    </div>}
  </div>
}
