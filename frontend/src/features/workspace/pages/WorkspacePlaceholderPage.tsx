import { useLocation } from 'react-router-dom'

const pageNames: Record<string, string> = {
  overview: 'Overview',
  roadmap: 'My Roadmap',
  'skill-profile': 'Skill Profile',
  'market-insights': 'Market Insights',
  applications: 'Applications',
  progress: 'Progress',
  assessments: 'Assessments',
}

export function WorkspacePlaceholderPage() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const currentPath = segments[segments.length - 1] ?? ''
  const title = pageNames[currentPath] ?? 'Workspace'

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        GlowJob Workspace
      </p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is ready for the next feature.
      </p>
    </section>
  )
}