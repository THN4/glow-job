import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'
import { WorkspacePageHeader } from '../../workspace/components/WorkspacePageHeader'

export function SkillProfileHeader() {
  return (
    <WorkspacePageHeader
      title="Skill Profile"
      description="Track your learning progress across skills and projects in your saved roadmap."
      actions={<Link
        to="/app/roadmap"
        aria-label="View my roadmap"
        className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 hover:bg-accent"
      >
        <Map size={22} aria-hidden="true" />
        <span>View</span>
      </Link>}
    />
  )
}
