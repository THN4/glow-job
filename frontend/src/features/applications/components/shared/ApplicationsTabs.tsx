import { Building2, BriefcaseBusiness, GitBranch } from 'lucide-react'
import type { ApplicationTabKey } from '../../type'

type ApplicationsTabsProps = {
  activeTab: ApplicationTabKey
  onChange: (tab: ApplicationTabKey) => void
}

const tabs: { id: ApplicationTabKey; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: 'my-applications', label: 'My Applications', icon: BriefcaseBusiness },
  { id: 'recommendations', label: 'Career Recommendations', icon: GitBranch },
  { id: 'companies', label: 'Companies', icon: Building2 },
]

export function ApplicationsTabs({ activeTab, onChange }: ApplicationsTabsProps) {
  return (
    <nav aria-label="Application sections" role="tablist" className="flex shrink-0 gap-2 overflow-x-auto border-b border-blue-100">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          id={`applications-tab-${id}`}
          role="tab"
          aria-selected={activeTab === id}
          aria-controls="applications-tabpanel"
          onClick={() => onChange(id)}
          className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition ${activeTab === id ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  )
}
