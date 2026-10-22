import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { roadmapConnections } from '../../roadmap/data/roadmapMockData'
import { RoadmapNodeIcon } from '../../roadmap/components/RoadmapNodeIcon'
import { updateRoadmapChecklist, useRoadmapCounts } from '../../roadmap/useRoadmapCounts'
import { SkillProfileHeader } from '../components/SkillProfileHeader'
import { SkillProfileStats } from '../components/SkillProfileStats'
import { LearningChecklist } from '../components/LearningChecklist'
import { roadmapSummary } from '../../roadmap/data/roadmapMockData'

type SkillFilter = 'all' | 'completed' | 'in-progress' | 'upcoming'

const statusLabel = {
  completed: 'Completed',
  'in-progress': 'In progress',
  upcoming: 'Up next',
} as const

const statusStyle = {
  completed: 'bg-emerald-50 text-emerald-700',
  'in-progress': 'bg-blue-50 text-blue-700',
  upcoming: 'bg-slate-100 text-slate-600',
} as const

const roadmapNodePath = (nodeId: string) => `/app/roadmap?node=${encodeURIComponent(nodeId)}`

export function SkillProfilePage() {
  const roadmapCounts = useRoadmapCounts()
  const [selectedFilter, setSelectedFilter] = useState<SkillFilter>('all')
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(() => new Set())
  const visibleNodes = roadmapCounts.nodes.filter((node) => ['skill', 'project'].includes(node.kind)
    && (selectedFilter === 'all' || node.status === selectedFilter))
  const visibleSkills = visibleNodes.filter((node) => node.kind === 'skill').length
  const visibleProjects = visibleNodes.filter((node) => node.kind === 'project').length
  const visibleLabel = selectedFilter === 'all' ? 'Roadmap skills' : statusLabel[selectedFilter]
  const projectCounts = {
    totalProjects: roadmapCounts.nodes.filter((node) => node.kind === 'project').length,
    completedProjects: roadmapCounts.nodes.filter((node) => node.kind === 'project' && node.status === 'completed').length,
    inProgressProjects: roadmapCounts.nodes.filter((node) => node.kind === 'project' && node.status === 'in-progress').length,
    upcomingProjects: roadmapCounts.nodes.filter((node) => node.kind === 'project' && node.status === 'upcoming').length,
  }
  const toggleSkillChecklist = (nodeId: string) => {
    setExpandedSkillIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }
  const handleSkillCardClick = (nodeId: string) => (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button, input, label, [data-skill-checklist]')) return
    toggleSkillChecklist(nodeId)
  }
  const handleSkillCardKeyDown = (nodeId: string) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleSkillChecklist(nodeId)
    }
  }
  const selectSkillFilter = (filter: SkillFilter) => {
    setSelectedFilter(filter)
    if (filter === 'in-progress') {
      setExpandedSkillIds(new Set(roadmapCounts.nodes
        .filter((node) => node.kind === 'skill' && node.status === 'in-progress')
        .map((node) => node.id)))
    }
  }

  return (
    <section aria-label="Skill profile" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4 [@media(max-height:960px)]:gap-3">
      <SkillProfileHeader targetRole={roadmapSummary.targetRole} duration={roadmapSummary.duration} />

      <SkillProfileStats
        {...roadmapCounts}
        {...projectCounts}
        selected={selectedFilter}
        onSelect={selectSkillFilter}
      />

      <section aria-live="polite" aria-label={`${visibleLabel} details`} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">{visibleLabel}</h2>
          <span className="text-xs text-slate-500">{visibleSkills} {visibleSkills === 1 ? 'skill' : 'skills'} · {visibleProjects} {visibleProjects === 1 ? 'project' : 'projects'}</span>
        </div>
        {visibleNodes.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNodes.map((node) => node.kind === 'skill' && node.status === 'in-progress' ? (
              <article key={node.id} tabIndex={0} aria-expanded={expandedSkillIds.has(node.id)} aria-controls={`checklist-${node.id}`} onClick={handleSkillCardClick(node.id)} onKeyDown={handleSkillCardKeyDown(node.id)} className="cursor-pointer rounded-lg border border-blue-200 bg-white p-3 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:col-span-2 lg:col-span-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Link to={roadmapNodePath(node.id)} aria-label={`Open ${node.title} in roadmap`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <RoadmapNodeIcon node={node} size={20} />
                    </Link>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900"><Link to={roadmapNodePath(node.id)} className="hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{node.title}</Link></h3>
                      <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle[node.status]}`}>
                    {statusLabel[node.status]}
                  </span>
                </div>
                {expandedSkillIds.has(node.id) && (
                  <div className="mt-3 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                    <div id={`checklist-${node.id}`} data-skill-checklist>
                      <LearningChecklist
                        items={node.checklist ?? []}
                        hideTitle
                        onToggle={(itemId) => {
                          const item = node.checklist?.find((entry) => entry.id === itemId)
                          if (item) updateRoadmapChecklist(node.id, itemId, !item.completed)
                        }}
                      />
                    </div>
                    <div className="border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">Related project</p>
                      {(() => {
                        const edge = roadmapConnections.find((connection) => connection.from === node.id
                          && roadmapCounts.nodes.some((candidate) => candidate.id === connection.to && candidate.kind === 'project'))
                        const project = roadmapCounts.nodes.find((candidate) => candidate.id === edge?.to)
                        return project ? (
                          <Link to={roadmapNodePath(project.id)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
                            <RoadmapNodeIcon node={project} size={16} />{project.title}<ExternalLink size={12} aria-hidden="true" />
                          </Link>
                        ) : <p className="mt-1 text-xs text-slate-500">No related project is mapped yet.</p>
                      })()}
                    </div>
                  </div>
                  </div>
                )}
              </article>
            ) : (
              <article key={node.id} tabIndex={node.kind === 'skill' ? 0 : undefined} aria-expanded={node.kind === 'skill' ? expandedSkillIds.has(node.id) : undefined} aria-controls={node.kind === 'skill' ? `checklist-${node.id}` : undefined} onClick={node.kind === 'skill' ? handleSkillCardClick(node.id) : undefined} onKeyDown={node.kind === 'skill' ? handleSkillCardKeyDown(node.id) : undefined} className={`rounded-lg border border-slate-100 bg-white p-3 ${node.kind === 'skill' ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link to={roadmapNodePath(node.id)} aria-label={`Open ${node.title} in roadmap`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <RoadmapNodeIcon node={node} size={18} />
                    </Link>
                    <Link to={roadmapNodePath(node.id)} className="text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      {node.title}
                    </Link>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle[node.status]}`}>
                    {statusLabel[node.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                {node.kind === 'skill' && expandedSkillIds.has(node.id) && (
                      <div id={`checklist-${node.id}`} data-skill-checklist className="mt-2">
                        <LearningChecklist
                          items={node.checklist ?? []}
                          readOnly={node.status !== 'in-progress'}
                          hideTitle
                          onToggle={(itemId) => {
                            const item = node.checklist?.find((entry) => entry.id === itemId)
                            if (item) updateRoadmapChecklist(node.id, itemId, !item.completed)
                          }}
                        />
                      </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No {visibleLabel.toLowerCase()} skills or projects yet. Your roadmap progress will appear here.
          </p>
        )}
      </section>
    </section>
  )
}
