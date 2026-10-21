import { NavLink } from 'react-router-dom'
import { workspaceNavigationItems } from '../data/navigationItems'

export function WorkspaceNavigation() {
  return (
    <nav aria-label="Workspace navigation" className="mt-6 shrink-0 [@media(max-height:900px)]:mt-3">
      <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wide text-slate-400 [@media(max-height:900px)]:mb-1">
        Workspace
      </p>

      <ul className="space-y-1">
        {workspaceNavigationItems.map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <NavLink
              to={href}
              end
              className={({ isActive }) =>
                `relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition [@media(max-height:900px)]:min-h-8 [@media(max-height:900px)]:py-1 ${
                  isActive
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-blue-600"
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
