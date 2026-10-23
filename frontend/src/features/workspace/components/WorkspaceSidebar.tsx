import { PanelLeftClose } from 'lucide-react'
import { CurrentGoalCard } from './CurrentGoalCard'
import { MarketUpdatesCard } from './MarketUpdatesCard'
import { WorkspaceAccountFooter } from './WorkspaceAccountFooter'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Logo } from '../../../components/shared/Logo'
import type {
  CurrentGoalSummary,
  MarketUpdate,
  WorkspaceUser,
} from '../type'

type WorkspaceSidebarProps = {
  isOpen: boolean
  onClose: () => void
  goal: CurrentGoalSummary
  marketUpdate: MarketUpdate
  user: WorkspaceUser
  onViewInsights: () => void
  onHelpClick: () => void
  onProfileClick: () => void
}

export function WorkspaceSidebar({
  isOpen,
  onClose,
  goal,
  marketUpdate,
  user,
  onViewInsights,
  onHelpClick,
  onProfileClick,
}: WorkspaceSidebarProps) {
  return (
    <aside id="workspace-sidebar" aria-label="Workspace sidebar" hidden={!isOpen} className={`hidden ${isOpen ? 'sidebar-expanded:flex' : ''} h-dvh shrink-0 flex-col overflow-hidden border-r border-border bg-white px-4 py-5 sidebar-expanded:sticky sidebar-expanded:top-0 sidebar-expanded:w-[24vw] sidebar-expanded:min-w-60 sidebar-expanded:max-w-[401px] xl:px-5`}>
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Logo className="w-10 items-start [&>img]:size-10 xl:w-14 xl:[&>img]:size-14" />
            <p className="text-2xl font-bold leading-tight tracking-tight text-foreground">
              Glow<span className="text-primary">Job</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            aria-expanded={isOpen}
            aria-controls="workspace-sidebar"
            title="Close sidebar"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PanelLeftClose size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI Navigation
        </p>
      </div>

      <div className="scrollbar-subtle mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [@media(max-height:900px)]:mt-3">
        <div className="shrink-0">
          <CurrentGoalCard goal={goal} />
        </div>

        <WorkspaceNavigation />

        <div className="mt-auto shrink-0 pb-3 pt-5 [@media(max-height:900px)]:pt-2">
          <MarketUpdatesCard
            update={marketUpdate}
            onViewInsights={onViewInsights}
            isNew
          />
        </div>
      </div>
      <div className="shrink-0 bg-white pt-3 [@media(max-height:900px)]:pt-1">
        <WorkspaceAccountFooter
          user={user}
          onHelpClick={onHelpClick}
          onProfileClick={onProfileClick}
        />
      </div>
    </aside>
  )
}
