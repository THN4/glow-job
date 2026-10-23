import { learningStatusIcons } from '../../../components/statusIcons'
import { StatCard, StatGrid } from '../../workspace/components/StatCard'
import { FilterSelect } from '../../applications/components/shared/FilterSelect'
import { BookOpen, ListFilter } from 'lucide-react'

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
  const selectedIndex = Math.max(0, stats.findIndex((stat) => stat.filter === selected))
  const stat = stats[selectedIndex]

  return (
    <section aria-label="Skill progress summary">
      <div className="space-y-3 sm:hidden">
        <FilterSelect label="Status" icon={ListFilter} value={selected}
          options={stats.map(({ label, value, filter }) => ({ value: filter, label: `${label} (${value})` }))}
          onChange={(value) => {
            const next = stats.find((item) => item.filter === value)
            if (next) onSelect(next.filter)
          }} />
        <StatCard label={stat.label} value={stat.value}
          icon={statStyles[selectedIndex].icon} tone={statStyles[selectedIndex].tone}
          detail={`${stat.projects} ${stat.projects === 1 ? 'project' : 'projects'}`}
          progress={total > 0 ? stat.value / total * 100 : null} />
      </div>
      <div className="hidden sm:block">
        <StatGrid>
          {stats.map(({ label, value, projects, filter }, index) => (
            <StatCard key={label} label={label} value={value}
              icon={statStyles[index].icon} tone={statStyles[index].tone}
              detail={`${projects} ${projects === 1 ? 'project' : 'projects'}`}
              progress={total > 0 ? value / total * 100 : null}
              selected={selected === filter} onClick={() => onSelect(filter)} />
          ))}
        </StatGrid>
      </div>
    </section>
  )
}
