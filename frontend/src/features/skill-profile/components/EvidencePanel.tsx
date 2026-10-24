import { Award, FileText, FolderGit2, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import type { SkillEvidenceSource } from '../type'

type EvidencePanelProps = {
  selected: SkillEvidenceSource[]
  onToggle: (source: SkillEvidenceSource) => void
  compact?: boolean
}

const evidenceOptions: { label: SkillEvidenceSource; icon: typeof FolderGit2 }[] = [
  { label: 'GitHub project', icon: FolderGit2 },
  { label: 'Certificate', icon: Award },
  { label: 'Self report', icon: FileText },
]

export function EvidencePanel({ selected, onToggle, compact = false }: EvidencePanelProps) {
  const [showOptions, setShowOptions] = useState(false)

  return (
    <section className={compact ? '' : 'rounded-lg border border-blue-100 bg-white p-2.5'} aria-label="Evidence">
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Star size={15} className="text-amber-500" aria-hidden="true" />
            Evidence
          </h4>
          <span className="text-[11px] text-slate-500">{selected.length ? `${selected.length} added` : 'No evidence added'}</span>
        </div>
      )}
      {compact && (
        <>
          <p className="mb-2 text-xs text-slate-500">
            {selected.length ? `${selected.length} evidence source${selected.length === 1 ? '' : 's'} added` : 'No evidence added · Optional'}
          </p>
          <button
            type="button"
            onClick={() => setShowOptions((shown) => !shown)}
            aria-expanded={showOptions}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            <Plus size={12} aria-hidden="true" />
            {showOptions ? 'Hide evidence options' : 'Add evidence'}
          </button>
        </>
      )}
      {(!compact || showOptions) && <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-2'}`}>
        {evidenceOptions.map(({ label, icon: Icon }) => {
          const isSelected = selected.includes(label)
          return (
            <button
              key={label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(label)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] transition ${isSelected ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-blue-100 bg-white text-slate-500 hover:bg-blue-50'}`}
            >
              {isSelected ? <Icon size={11} aria-hidden="true" /> : <Plus size={10} aria-hidden="true" />}
              {label}
            </button>
          )
        })}
      </div>}
    </section>
  )
}
