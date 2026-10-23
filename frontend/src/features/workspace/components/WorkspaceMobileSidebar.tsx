import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../../../components/ui/sheet'
import { WorkspaceSidebar, type WorkspaceSidebarProps } from './WorkspaceSidebar'

type Props = Omit<WorkspaceSidebarProps, 'isOpen' | 'onClose' | 'presentation' | 'id' | 'onNavigate'>

export function WorkspaceMobileSidebar(props: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <button type="button" aria-label="Open workspace menu" title="Open workspace menu"
        className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Menu size={20} aria-hidden="true" />
      </button>
    </SheetTrigger>
    <SheetContent side="left" showCloseButton={false} className="gap-0 overflow-hidden p-0">
      <SheetTitle className="sr-only">Workspace menu</SheetTitle>
      <SheetDescription className="sr-only">Choose a workspace page.</SheetDescription>
      <WorkspaceSidebar {...props} isOpen={open} presentation="drawer" id="workspace-mobile-sidebar"
        onClose={close} onNavigate={close}
        onViewInsights={() => { close(); props.onViewInsights() }}
        onHelpClick={() => { close(); props.onHelpClick() }}
        onProfileClick={() => { close(); props.onProfileClick() }} />
    </SheetContent>
  </Sheet>
}
