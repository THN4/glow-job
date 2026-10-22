import { LayoutDashboard, Sparkles, Workflow, type LucideIcon } from 'lucide-react'
import pythonIcon from '../../../../assets/technology/python.svg'

const icons: Record<string, LucideIcon> = {
  'analytics-engineer': Workflow,
  'bi-developer': LayoutDashboard,
}

type CareerPathIconProps = {
  pathId: string
  size?: number
}

export function CareerPathIcon({ pathId, size = 16 }: CareerPathIconProps) {
  if (pathId === 'python-backend-developer') {
    return <img src={pythonIcon} alt="" width={size} height={size} className="object-contain" />
  }

  const Icon = icons[pathId] ?? Sparkles
  return <Icon size={size} aria-hidden="true" />
}
