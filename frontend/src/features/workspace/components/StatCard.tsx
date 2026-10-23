import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  label: string
  value: ReactNode
  icon?: LucideIcon
  tone?: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'destructive'
  detail?: ReactNode
  progress?: number | null
  selected?: boolean
  onClick?: () => void
  compactOnMobile?: boolean
}

const tones = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', detail, progress, selected, onClick, compactOnMobile = false }: StatCardProps) {
  const progressValue = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress)) : undefined
  const content = <>
    <div className="flex min-h-5 items-start gap-2">
      {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
      <span className="text-xs font-semibold leading-5 text-black">{label}</span>
    </div>
    <div className="mt-2 break-words text-2xl font-bold leading-8 tracking-tight text-black tabular-nums">{value}</div>
    {detail !== undefined && <div className="mt-1 text-xs leading-5 text-black">{detail}</div>}
    {progress !== undefined && <div className="mt-auto pt-3">
      <div role={progressValue === undefined ? 'img' : 'progressbar'}
        aria-label={progressValue === undefined ? `${label}: no data available` : label}
        aria-valuemin={progressValue === undefined ? undefined : 0}
        aria-valuemax={progressValue === undefined ? undefined : 100}
        aria-valuenow={progressValue}
        className="h-1.5 overflow-hidden rounded-full bg-current/10">
        <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${progressValue ?? 0}%` }} />
      </div>
    </div>}
  </>
  const className = `flex min-w-0 flex-col rounded-xl border bg-card text-left font-sans shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:bg-accent hover:shadow-md motion-reduce:transition-none ${compactOnMobile ? 'min-h-32 p-3 sm:min-h-36 sm:p-4' : 'min-h-36 p-4'} ${tones[tone]} ${onClick ? 'cursor-pointer focus-visible:bg-accent focus-visible:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : ''} ${selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40'}`

  return onClick
    ? <button type="button" aria-pressed={selected} onClick={onClick} className={className}>{content}</button>
    : <article className={className}>{content}</article>
}

export function StatGrid({ children, columns = 4, label, mobileColumns = 1 }: { children: ReactNode; columns?: 3 | 4 | 5; label?: string; mobileColumns?: 1 | 2 }) {
  const widths = { 3: 'lg:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' }
  return <div aria-label={label} role={label ? 'group' : undefined} className={`grid auto-rows-fr gap-3 ${mobileColumns === 2 ? 'grid-cols-2' : 'grid-cols-1 min-[400px]:grid-cols-2'} ${widths[columns]}`}>{children}</div>
}
