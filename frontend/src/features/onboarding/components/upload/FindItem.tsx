import type { LucideIcon } from 'lucide-react'
import { IconBox, type IconColor } from '../../../../components/shared/IconBox'

type FindItemProps = { icon: LucideIcon; color: IconColor; title: string; description: string }

export function FindItem({ icon, color, title, description }: FindItemProps) {
  return <li className="flex items-start gap-5">
    <IconBox icon={icon} color={color} />
    <div className="min-w-0">
      <h3 className="text-base font-semibold leading-6 text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  </li>
}
