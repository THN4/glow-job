import type { ReactNode } from 'react'
import { cn } from '../../../../lib/utils'

type PageHeaderProps = { title: string; subtitle: string; badge?: ReactNode; className?: string }

export function PageHeader({ title, subtitle, badge, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-4 sm:mb-5', className)}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl xl:text-4xl">{title}</h1>
        {badge}
      </div>
      <p className="mt-3 whitespace-pre-line text-base leading-7 text-muted-foreground sm:text-lg xl:text-xl">{subtitle}</p>
    </header>
  )
}
