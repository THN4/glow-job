import { applicationStatusIcons, learningStatusIcons } from '../../../../components/statusIcons'
import { StatCard, StatGrid } from '../../../workspace/components/StatCard'
import { BriefcaseBusiness } from 'lucide-react'
import type { ApplicationEntry, ApplicationStatusFilter } from '../../type'

type ApplicationStatsProps = {
  applications: ApplicationEntry[]
  selectedStatus: ApplicationStatusFilter
  onSelectStatus: (status: ApplicationStatusFilter) => void
}

export function ApplicationStats({ applications, selectedStatus, onSelectStatus }: ApplicationStatsProps) {
  const stats = [
    { label: 'Total', value: applications.length, icon: BriefcaseBusiness, tone: 'primary' as const, filter: 'all' as const },
    { label: 'In Progress', value: applications.filter(({ status }) => ['applied', 'screening', 'interview'].includes(status)).length, icon: learningStatusIcons['in-progress'], tone: 'primary' as const, filter: 'in-progress' as const },
    { label: 'Interviews', value: applications.filter(({ status }) => status === 'interview').length, icon: applicationStatusIcons.interview, tone: 'warning' as const, filter: 'interview' as const },
    { label: 'Offers', value: applications.filter(({ status }) => status === 'offer').length, icon: applicationStatusIcons.offer, tone: 'success' as const, filter: 'offer' as const },
    { label: 'Rejected', value: applications.filter(({ status }) => status === 'rejected').length, icon: applicationStatusIcons.rejected, tone: 'destructive' as const, filter: 'rejected' as const },
  ]

  return (
    <StatGrid columns={5} label="Application statistics">
      {stats.map(({ label, value, icon, tone, filter }) => (
        <StatCard key={label} label={label} value={value} icon={icon} tone={tone}
          selected={selectedStatus === filter} onClick={() => onSelectStatus(filter)} />
      ))}
    </StatGrid>
  )
}
