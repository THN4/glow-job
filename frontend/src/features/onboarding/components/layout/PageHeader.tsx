import type { ReactNode } from 'react'
import { cn } from '../../../../lib/utils'

type PageHeaderProps = { title: string; subtitle: string; badge?: ReactNode; className?: string }

export function PageHeader({ title, subtitle, badge, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-4 sm:mb-5', className)}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]">{title}</h1>
        {badge}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>
    </header>
  )
}
