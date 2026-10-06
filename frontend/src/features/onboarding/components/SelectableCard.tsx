import { useId } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'

export type SelectOption<Value extends string> = {
  value: Value
  label: string
  sublabel?: string
  icon?: LucideIcon
  iconClassName?: string
  disabled?: boolean
}

export type SelectCardVariant = 'default' | 'inline-radio'

type SelectableCardProps = {
  selected: boolean
  onSelect: () => void
  label: string
  sublabel?: string
  icon?: LucideIcon
  iconClassName?: string
  tabIndex?: number
  disabled?: boolean
  className?: string
  cardVariant?: SelectCardVariant
}

export function SelectableCard({ selected, onSelect, label, sublabel, icon: Icon,
  iconClassName, tabIndex = selected ? 0 : -1, disabled, className, cardVariant = 'default' }: SelectableCardProps) {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <Button
      type="button"
      variant="outline"
      role="radio"
      aria-checked={selected}
      aria-labelledby={labelId}
      aria-describedby={sublabel ? descriptionId : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      tabIndex={tabIndex}
      disabled={disabled}
      className={cn(
        'relative h-auto min-h-18 w-full min-w-0 flex-col gap-1.5 whitespace-normal rounded-xl border-border bg-card px-3 py-2 text-base font-normal shadow-none hover:border-primary/50 hover:bg-accent',
        Icon && 'min-h-22 justify-start',
        selected && 'border-primary bg-accent text-primary shadow-sm hover:border-primary',
        cardVariant === 'inline-radio' && 'min-h-14 flex-row justify-start gap-4 px-4 py-1.5 text-left',
        className,
      )}
    >
      {selected && cardVariant === 'default' && <span className="absolute right-1.5 top-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
        <Check className="size-3" strokeWidth={3} />
      </span>}
      {cardVariant === 'inline-radio' && <span aria-hidden="true" className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input', selected && 'border-primary')}>
        {selected && <span className="size-3 rounded-full bg-primary" />}
      </span>}
      {Icon && <Icon className={cn('size-6 text-primary', iconClassName)} strokeWidth={1.6} aria-hidden="true" />}
      <span className="flex min-w-0 flex-col gap-1.5">
        <span id={labelId} className={cn('whitespace-pre-line leading-5', Icon && !selected && 'text-muted-foreground', !Icon && 'font-medium')}>{label}</span>
        {sublabel && <span id={descriptionId} className={cn('text-sm leading-5 text-muted-foreground', cardVariant === 'inline-radio' && selected && 'text-primary')}>{sublabel}</span>}
      </span>
    </Button>
  )
}
