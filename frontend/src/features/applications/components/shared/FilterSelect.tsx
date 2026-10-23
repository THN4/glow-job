import { Check, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

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
      className={`group flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left shadow-sm outline-none transition hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-200 data-[state=open]:border-blue-400 data-[state=open]:ring-2 data-[state=open]:ring-blue-100 ${active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200/80 bg-white'}`}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-data-[state=open]:bg-blue-100"><Icon className="size-3.5" aria-hidden="true" /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="truncate text-xs font-semibold text-slate-800"><SelectPrimitive.Value>{selected?.label ?? value}</SelectPrimitive.Value></span>
      </span>
      <SelectPrimitive.Icon><ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180 group-data-[state=open]:text-blue-600" aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" align="start" sideOffset={8} collisionPadding={12}
        className="z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-blue-100 bg-white p-1.5 shadow-xl shadow-slate-900/10 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95">
        <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-blue-600"><ChevronUp className="size-4" aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="max-h-64 scroll-py-1 p-0.5">
          <SelectPrimitive.Group>
            <SelectPrimitive.Label className="px-3 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</SelectPrimitive.Label>
            {displayedOptions.map((option) =>
              <SelectPrimitive.Item key={option.value} value={`option:${option.value}`} textValue={option.label}
                className="relative flex min-h-10 cursor-pointer items-center rounded-xl py-2.5 pl-3 pr-9 text-xs leading-5 text-slate-600 outline-none transition-colors data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-800 data-[state=checked]:bg-blue-50/80 data-[state=checked]:font-semibold data-[state=checked]:text-blue-700">
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
