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
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'recommendations', label: 'Recommendations', icon: GitBranch },
]

export function ApplicationsTabs({ activeTab, onChange, showAddApplication, onAddApplication }: ApplicationsTabsProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-border">
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
        <button type="button" onClick={onAddApplication} aria-label="Add application" title="Add application"
          className="mb-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Plus size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
