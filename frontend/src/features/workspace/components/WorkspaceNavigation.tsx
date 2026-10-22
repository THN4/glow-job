import { NavLink } from 'react-router-dom'
import { workspaceNavigationItems } from '../data/navigationItems'

export function WorkspaceNavigation() {
  return (
    <nav aria-label="Workspace navigation" className="mt-6 shrink-0 [@media(max-height:900px)]:mt-3">
      <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground [@media(max-height:900px)]:mb-1">
        Workspace
      </p>

      <ul className="space-y-1">
        {workspaceNavigationItems.map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <NavLink
              to={href}
              end
              className={({ isActive }) =>
                `relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base leading-6 transition ${
                  isActive
                    ? 'bg-accent font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className="shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
