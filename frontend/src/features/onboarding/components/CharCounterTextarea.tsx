import { useId } from 'react'
import { Textarea } from '../../../components/ui/textarea'
import { NOTES_MAX_LENGTH, preferencesCopy } from '../../../lib/preferencesConstants'

type CharCounterTextareaProps = {
  value: string
  onChange: (value: string) => void
  labelledBy: string
  describedBy?: string
  placeholder?: string
  maxLength?: number
}

export function CharCounterTextarea({ value, onChange, labelledBy, describedBy,
  placeholder, maxLength = NOTES_MAX_LENGTH }: CharCounterTextareaProps) {
  const counterId = useId()
  return (
    <div className="relative">
      <Textarea value={value} onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        maxLength={maxLength} placeholder={placeholder} aria-labelledby={labelledBy}
        aria-describedby={[describedBy, counterId].filter(Boolean).join(' ')}
        className="min-h-26 resize-y border-border bg-card px-5 py-3 pb-8 text-base md:text-base" />
      <span id={counterId} className="pointer-events-none absolute bottom-2 right-4 text-sm text-muted-foreground">
        {preferencesCopy.characterCount(value.length, maxLength)}
      </span>
    </div>
  )
}
