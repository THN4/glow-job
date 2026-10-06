import { ChevronDown, CircleHelp } from 'lucide-react'
import { Button } from '../ui/button'
import { sharedCopy } from '../../lib/constants'

export function TopBar({ onHelp, onAccount, avatarSrc }: {
  onHelp?: () => void
  onAccount?: () => void
  avatarSrc?: string
}) {
  return <header className="flex h-16 shrink-0 items-center justify-end gap-4">
    <Button variant="ghost" onClick={onHelp} className="h-11 gap-3 text-base font-normal text-primary">
      <CircleHelp className="size-5" aria-hidden="true" />{sharedCopy.help}
    </Button>
    <span className="h-6 w-px bg-input" aria-hidden="true" />
    <Button variant="ghost" onClick={onAccount} aria-label={sharedCopy.account} className="h-12 gap-4 px-1 text-muted-foreground">
      {avatarSrc ? <img src={avatarSrc} alt="" className="size-11 rounded-full object-cover" /> :
        <span className="flex size-11 items-center justify-center rounded-full bg-secondary font-semibold text-primary" aria-hidden="true">{sharedCopy.avatarFallback}</span>}
      <ChevronDown className="size-5" aria-hidden="true" />
    </Button>
  </header>
}
