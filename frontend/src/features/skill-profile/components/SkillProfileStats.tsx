import { learningStatusIcons } from '../../../components/statusIcons'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { BookOpen } from 'lucide-react'

type SkillProfileStatsProps = {
  total: number
  completed: number
  inProgress: number
  upcoming: number
  totalProjects: number
  completedProjects: number
  inProgressProjects: number
  upcomingProjects: number
  selected: 'all' | 'completed' | 'in-progress' | 'upcoming'
  onSelect: (filter: SkillProfileStatsProps['selected']) => void
}

const statStyles = [
  { icon: BookOpen, tone: 'primary' as const },
  { icon: learningStatusIcons.completed, tone: 'success' as const },
  { icon: learningStatusIcons['in-progress'], tone: 'primary' as const },
  { icon: learningStatusIcons.upcoming, tone: 'muted' as const },
]

export function SkillProfileStats({ total, completed, inProgress, upcoming, totalProjects, completedProjects, inProgressProjects, upcomingProjects, selected, onSelect }: SkillProfileStatsProps) {
  const stats = [
    { label: 'Roadmap skills', value: total, projects: totalProjects, filter: 'all' as const },
    { label: 'Completed', value: completed, projects: completedProjects, filter: 'completed' as const },
    { label: 'In progress', value: inProgress, projects: inProgressProjects, filter: 'in-progress' as const },
    { label: 'Up next', value: upcoming, projects: upcomingProjects, filter: 'upcoming' as const },
  ]

  return (
    <StatGrid label="Skill progress summary">
      {stats.map(({ label, value, projects, filter }, index) => (
        <StatCard key={label} label={label} value={value}
          icon={statStyles[index].icon} tone={statStyles[index].tone}
          detail={`${projects} ${projects === 1 ? 'project' : 'projects'}`}
          progress={total > 0 ? value / total * 100 : null}
          selected={selected === filter} onClick={() => onSelect(filter)} />
      ))}
    </StatGrid>
  )
}
