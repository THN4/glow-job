import { ChevronDown, CircleHelp } from 'lucide-react'
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
    <footer className="border-t border-slate-100 pt-3 [@media(max-height:900px)]:pt-2">
      <div className="mb-2 min-w-0 [@media(max-height:900px)]:mb-1">
        <p className="truncate text-xs font-semibold text-slate-900">
          {user.name}
        </p>
        <p className="truncate text-[10px] text-slate-500">{user.subtitle}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onHelpClick}
          className="inline-flex min-h-9 items-center gap-2 text-xs text-blue-600 hover:text-blue-800 [@media(max-height:900px)]:min-h-8"
        >
          <CircleHelp size={16} aria-hidden="true" />
          Need help?
        </button>

        <button
          type="button"
          onClick={onProfileClick}
          aria-label={`Open ${user.name}'s profile menu`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-50 [@media(max-height:900px)]:min-h-8"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
            >
              {getInitials(user.name)}
            </span>
          )}

          <ChevronDown
            size={14}
            className="text-slate-500"
            aria-hidden="true"
          />
        </button>
      </div>
    </footer>
  )
}
