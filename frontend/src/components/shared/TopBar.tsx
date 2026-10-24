import { ChevronDown, CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { sharedCopy } from '../../lib/constants'

export function TopBar({ onHelp, onAccount, avatarSrc, leading }: {
  onHelp?: () => void
  onAccount?: () => void
  avatarSrc?: string
  leading?: ReactNode
}) {
  return <header className="flex min-h-20 shrink-0 items-center justify-end gap-2 sm:gap-4 sidebar-expanded:min-h-16">
    {leading && <div className="mr-auto min-w-0 sidebar-expanded:hidden">{leading}</div>}
    <Button variant="ghost" onClick={onHelp} aria-label={sharedCopy.help} className="size-11 shrink-0 gap-2 p-0 text-sm font-normal text-primary roomy-header:w-auto roomy-header:px-3">
      <CircleHelp className="size-5" aria-hidden="true" /><span className="hidden roomy-header:inline">{sharedCopy.help}</span>
    </Button>
    <span className="hidden h-6 w-px bg-input sm:block" aria-hidden="true" />
    <Button variant="ghost" onClick={onAccount} aria-label={sharedCopy.account} className="h-11 shrink-0 gap-1 px-1 text-muted-foreground sm:gap-2 sidebar-expanded:h-12 sidebar-expanded:gap-4">
      {avatarSrc ? <img src={avatarSrc} alt="" className="size-8 rounded-full object-cover sm:size-9 sidebar-expanded:size-11" /> :
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary sm:size-9 sidebar-expanded:size-11" aria-hidden="true">{sharedCopy.avatarFallback}</span>}
      <ChevronDown className="size-4 sm:size-5" aria-hidden="true" />
    </Button>
  </header>
}
