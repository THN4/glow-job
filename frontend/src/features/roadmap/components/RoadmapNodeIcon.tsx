import { BriefcaseBusiness, Cloud, Code2, Database, Package, Star, Workflow } from 'lucide-react'
import dockerLogo from '../../../assets/technology/docker.svg'
import pythonLogo from '../../../assets/technology/python.svg'
import airflowLogo from '../../../assets/technology/apacheairflow.svg'
import githubLogo from '../../../assets/technology/github.svg'
import type { RoadmapNodeData } from '../type'

type RoadmapNodeIconProps = { node: RoadmapNodeData; size?: number }

export function RoadmapNodeIcon({ node, size = 20 }: RoadmapNodeIconProps) {
  const name = node.title.toLowerCase()
  let logo: string | undefined
  if (node.id === 'docker' || node.id === 'containerize-etl' || /\bdocker\b/.test(name)) logo = dockerLogo
  else if (node.id === 'python' || /\bpython\b/.test(name)) logo = pythonLogo
  else if (/\bairflow\b/.test(name)) logo = airflowLogo
  else if (/\bgithub\b/.test(name)) logo = githubLogo

  if (logo) return <img src={logo} alt="" aria-hidden="true" width={size} height={size} className="shrink-0 object-contain" />

  const Icon = node.id === 'sql' ? Database
    : node.id === 'deploy-to-cloud' ? Cloud
    : /\betl\b/.test(name) ? Workflow
    : node.kind === 'project' ? Package
    : node.kind === 'career-activity' ? BriefcaseBusiness
    : node.kind === 'goal' ? Star
    : Code2
  return <Icon size={size} strokeWidth={2.3} aria-hidden="true" />
}
