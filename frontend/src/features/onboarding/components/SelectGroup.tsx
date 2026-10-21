import type { KeyboardEvent } from 'react'
import { cn } from '../../../lib/utils'
import { SelectableCard, type SelectOption, type SelectCardVariant } from './SelectableCard'

type SelectGroupProps<Value extends string> = {
  value: Value | null
  onChange: (value: Value) => void
  options: readonly SelectOption<Value>[]
  labelledBy: string
  describedBy?: string
  className?: string
  cardVariant?: SelectCardVariant
}

export function SelectGroup<Value extends string>({ value, onChange, options,
  labelledBy, describedBy, className, cardVariant }: SelectGroupProps<Value>) {
  const focusValue = options.find((option) => option.value === value && !option.disabled)?.value
    ?? options.find((option) => !option.disabled)?.value

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'))
      .filter((button) => !button.disabled)
    const current = buttons.findIndex((button) => button === event.target)
    if (current < 0 || !buttons.length) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
    buttons[next].click()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}
      onKeyDown={handleKeyDown} className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {options.map((option) => <SelectableCard key={option.value} {...option}
        selected={value === option.value} tabIndex={focusValue === option.value ? 0 : -1} cardVariant={cardVariant}
        onSelect={() => onChange(option.value)} />)}
    </div>
  )
}
