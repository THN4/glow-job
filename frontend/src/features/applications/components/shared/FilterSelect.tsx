import { Check, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import { workspaceStyles } from '../../../workspace/workspaceStyles'

export function FilterSelect({ label, icon: Icon, value, onChange, options }: {
  label: string; icon: LucideIcon; value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const displayedOptions = options.some((option) => option.value === value)
    ? options : [...options, { value, label: value }]
  const selected = displayedOptions.find((option) => option.value === value)
  const active = value !== options[0]?.value
  // Prefix every value: Radix reserves an empty string for clearing a selection.
  return <SelectPrimitive.Root value={`option:${value}`} onValueChange={(next) => onChange(next.slice(7))}>
    <SelectPrimitive.Trigger aria-label={`${label}: ${selected?.label ?? value}`}
      className={`${workspaceStyles.filter} group flex w-full items-center gap-2 py-2 text-left hover:border-primary/40 hover:bg-accent data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20 ${active ? 'ring-1 ring-primary/20' : ''}`}>
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">{label}:</span>
        <span className="truncate text-sm text-foreground"><SelectPrimitive.Value>{selected?.label ?? value}</SelectPrimitive.Value></span>
      </span>
      <SelectPrimitive.Icon><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary" aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" align="start" sideOffset={8} collisionPadding={12}
        className="z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card p-1.5 font-sans text-foreground shadow-xl motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95">
        <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-blue-600"><ChevronUp className="size-4" aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="max-h-64 scroll-py-1 p-0.5">
          <SelectPrimitive.Group>
            <SelectPrimitive.Label className="px-3 pb-2 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</SelectPrimitive.Label>
            {displayedOptions.map((option) =>
              <SelectPrimitive.Item key={option.value} value={`option:${option.value}`} textValue={option.label}
                className="relative flex min-h-10 cursor-pointer items-center rounded-lg py-2 pl-3 pr-9 text-sm leading-5 text-foreground outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-primary data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-primary">
                <SelectPrimitive.ItemText><span className="break-words">{option.label}</span></SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 flex size-4 items-center justify-center text-blue-600"><Check className="size-4" strokeWidth={2.5} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>)}
          </SelectPrimitive.Group>
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-blue-600"><ChevronDown className="size-4" aria-hidden="true" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
}
