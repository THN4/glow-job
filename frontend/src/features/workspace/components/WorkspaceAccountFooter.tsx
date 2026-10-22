import { CircleHelp } from 'lucide-react'
import type { WorkspaceUser } from '../type'

type WorkspaceAccountFooterProps = {
  user: WorkspaceUser
  onHelpClick: () => void
  onProfileClick: () => void
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function WorkspaceAccountFooter({
  user,
  onHelpClick,
  onProfileClick,
}: WorkspaceAccountFooterProps) {
  return (
    <footer className="border-t border-border pt-3 [@media(max-height:900px)]:pt-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onProfileClick}
          aria-label={`Open ${user.name}'s profile menu`}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:bg-primary/5"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-input/80 text-xs font-semibold text-primary"
            >
              {getInitials(user.name)}
            </span>
          )}

          <span className="min-w-0">
            <span className="block text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">
              {user.name}
            </span>
            <span className="block text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {user.subtitle}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onHelpClick}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs text-primary hover:text-primary/80"
        >
          <CircleHelp size={16} aria-hidden="true" />
          Need help?
        </button>
      </div>
    </footer>
  )
}
