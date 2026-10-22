import { Building2, BriefcaseBusiness, GitBranch, Plus } from 'lucide-react'
import type { ApplicationTabKey } from '../../type'

type ApplicationsTabsProps = {
  activeTab: ApplicationTabKey
  onChange: (tab: ApplicationTabKey) => void
  showAddApplication: boolean
  onAddApplication: () => void
}

const tabs: { id: ApplicationTabKey; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: 'my-applications', label: 'My Applications', icon: BriefcaseBusiness },
  { id: 'recommendations', label: 'Recommendations', icon: GitBranch },
  { id: 'companies', label: 'Companies', icon: Building2 },
]

export function ApplicationsTabs({ activeTab, onChange, showAddApplication, onAddApplication }: ApplicationsTabsProps) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-3 border-b border-blue-100">
      <nav aria-label="Application sections" role="tablist" className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            id={`applications-tab-${id}`}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls="applications-tabpanel"
            onClick={() => onChange(id)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition ${activeTab === id ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      {showAddApplication && (
        <button type="button" onClick={onAddApplication} className="mb-1 inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:px-4 sm:text-sm">
          <Plus size={15} aria-hidden="true" /> Add Application
        </button>
      )}
    </div>
  )
}
