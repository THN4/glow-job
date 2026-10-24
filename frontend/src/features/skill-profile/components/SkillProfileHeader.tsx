import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'
import { workspaceStyles } from '../../workspace/workspaceStyles'
import { WorkspacePageHeader } from '../../workspace/components/WorkspacePageHeader'

export function SkillProfileHeader() {
  return (
    <WorkspacePageHeader
      title="Skill Profile"
      description="Track your learning progress across skills and projects in your saved roadmap."
      actions={<Link
        to="/app/roadmap"
        aria-label="View my roadmap"
        className={workspaceStyles.outlineAction}
      >
        <Map size={16} aria-hidden="true" />
        <span>View</span>
      </Link>}
    />
  )
}
