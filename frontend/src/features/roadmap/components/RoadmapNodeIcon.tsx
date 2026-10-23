import { BriefcaseBusiness, Package, Star } from 'lucide-react'
import { SkillIcon } from '../../../components/SkillIcon'
import type { RoadmapNodeData } from '../type'

type RoadmapNodeIconProps = { node: RoadmapNodeData; size?: number }

export function RoadmapNodeIcon({ node, size = 20 }: RoadmapNodeIconProps) {
  if (node.kind === 'skill') return <SkillIcon name={node.title} skillId={node.skillId} size={size} />
  const Icon = node.kind === 'project' ? Package
    : node.kind === 'career-activity' ? BriefcaseBusiness
    : node.kind === 'goal' ? Star
    : Package
  return <Icon size={size} strokeWidth={2.3} aria-hidden="true" />
}
