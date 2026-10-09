import { ListChecks } from 'lucide-react'
import type { SkillChecklistItem } from '../type'

type LearningChecklistProps = {
  items: SkillChecklistItem[]
  onToggle: (itemId: string) => void
}

export function LearningChecklist({ items, onToggle }: LearningChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length

  return (
    <section aria-label="Learning checklist">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <ListChecks size={16} className="text-blue-600" aria-hidden="true" />
          Learning checklist
        </h4>
        <span className="text-[11px] text-slate-500">{completedCount} / {items.length} completed</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
        <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-slate-600">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onToggle(item.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <span className={item.completed ? 'text-slate-400 line-through' : ''}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
