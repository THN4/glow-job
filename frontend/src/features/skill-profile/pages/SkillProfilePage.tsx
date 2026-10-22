import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { RoadmapNodeIcon } from '../../roadmap/components/RoadmapNodeIcon'
import { loadCurrentRoadmap, setRoadmapTask } from '../../roadmap/api'
import { toRoadmapScreen } from '../../roadmap/adapter'
import type { RoadmapView } from '../../roadmap/api-types'
import type { RoadmapNodeStatus } from '../../roadmap/type'
import { getSavedProfileId } from '../../resume/api'
import { SkillProfileHeader } from '../components/SkillProfileHeader'
import { SkillProfileStats } from '../components/SkillProfileStats'
import { LearningChecklist } from '../components/LearningChecklist'

type SkillFilter = 'all' | 'completed' | 'in-progress' | 'upcoming'

const statusLabel: Record<RoadmapNodeStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  upcoming: 'Up next',
}

const statusStyle: Record<RoadmapNodeStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  'in-progress': 'bg-blue-50 text-blue-700',
  upcoming: 'bg-slate-100 text-slate-600',
}

const roadmapNodePath = (nodeId: string) => `/app/roadmap?node=${encodeURIComponent(nodeId)}`

export function SkillProfilePage() {
  const profileId = getSavedProfileId()
  const [view, setView] = useState<RoadmapView | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<SkillFilter>('all')
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadFailed(false)
    setError(null)
    loadCurrentRoadmap(controller.signal)
      .then(setView)
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setLoadFailed(true)
          setError(caught instanceof Error ? caught.message : 'Could not load your skill profile.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  const screen = useMemo(() => view ? toRoadmapScreen(view) : null, [view])
  const nodes = screen?.nodes ?? []
  const learningNodes = nodes.filter((node) => ['skill', 'project'].includes(node.kind))
  const visibleNodes = learningNodes.filter((node) => selectedFilter === 'all' || node.status === selectedFilter)
  const visibleSkills = visibleNodes.filter((node) => node.kind === 'skill').length
  const visibleProjects = visibleNodes.filter((node) => node.kind === 'project').length
  const visibleLabel = selectedFilter === 'all' ? 'Roadmap skills and projects' : statusLabel[selectedFilter]
  const projectCounts = {
    totalProjects: learningNodes.filter((node) => node.kind === 'project').length,
    completedProjects: learningNodes.filter((node) => node.kind === 'project' && node.status === 'completed').length,
    inProgressProjects: learningNodes.filter((node) => node.kind === 'project' && node.status === 'in-progress').length,
    upcomingProjects: learningNodes.filter((node) => node.kind === 'project' && node.status === 'upcoming').length,
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

  async function updateTask(nodeId: string, taskId: string, completed: boolean) {
    if (!view?.roadmapId || working) return
    setWorking(true)
    setError(null)
    try {
      setView(await setRoadmapTask(view.roadmapId, taskId, completed))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this checklist update.')
      setExpandedSkillIds((current) => new Set(current).add(nodeId))
    } finally {
      setWorking(false)
    }
  }

  const selectSkillFilter = (filter: SkillFilter) => {
    setSelectedFilter(filter)
    if (filter === 'in-progress') {
      setExpandedSkillIds(new Set(nodes
        .filter((node) => node.kind === 'skill' && node.status === 'in-progress')
        .map((node) => node.id)))
    }
  }

  if (loading) return <p role="status" className="p-6 text-sm text-slate-600">Loading your skill profile…</p>
  if (loadFailed) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">Could not load your skill profile</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
      <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
    </section>
  )
  if (!profileId) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-blue-100 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Skill Profile</h1>
      <p className="mt-3 text-sm text-slate-600">Save your profile and create a roadmap to see your learning progress here.</p>
      <Link to="/onboarding" className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Start onboarding</Link>
    </section>
  )
  if (!screen) return (
    <section className="mx-auto max-w-xl rounded-2xl border border-blue-100 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Skill Profile</h1>
      <p className="mt-3 text-sm text-slate-600">Create your roadmap to see database-backed skills, projects, and learning progress here.</p>
      <Link to="/app/roadmap" className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Open Roadmap</Link>
    </section>
  )

  return (
    <section aria-label="Skill profile" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4 [@media(max-height:960px)]:gap-3">
      <SkillProfileHeader targetRole={screen.summary.targetRole} duration={screen.summary.duration} />
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <SkillProfileStats
        total={learningNodes.filter((node) => node.kind === 'skill').length}
        completed={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'completed').length}
        inProgress={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'in-progress').length}
        upcoming={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'upcoming').length}
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
            {visibleNodes.map((node) => {
              const isExpandableSkill = node.kind === 'skill'
              const expanded = expandedSkillIds.has(node.id)
              const projectEdge = screen.connections.find((connection) => connection.from === node.id
                && nodes.some((candidate) => candidate.id === connection.to && candidate.kind === 'project'))
              const relatedProject = nodes.find((candidate) => candidate.id === projectEdge?.to)
              const profileLabel = screen.extras[node.id]?.profileLabel

              return (
                <article key={node.id} tabIndex={isExpandableSkill ? 0 : undefined}
                  aria-expanded={isExpandableSkill ? expanded : undefined}
                  aria-controls={isExpandableSkill ? `checklist-${node.id}` : undefined}
                  onClick={isExpandableSkill ? handleSkillCardClick(node.id) : undefined}
                  onKeyDown={isExpandableSkill ? handleSkillCardKeyDown(node.id) : undefined}
                  className={`rounded-lg border border-slate-100 bg-white p-3 ${isExpandableSkill ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : ''} ${node.kind === 'skill' && node.status === 'in-progress' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link to={roadmapNodePath(node.id)} aria-label={`Open ${node.title} in roadmap`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <RoadmapNodeIcon node={node} size={18} />
                      </Link>
                      <Link to={roadmapNodePath(node.id)} className="text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{node.title}</Link>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle[node.status]}`}>{statusLabel[node.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                  {node.kind === 'skill' && profileLabel && <p className="mt-1 text-[11px] font-medium text-blue-700">Profile level: {profileLabel}</p>}

                  {isExpandableSkill && expanded && (
                    <div id={`checklist-${node.id}`} data-skill-checklist className="mt-3 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                      <div>
                        <LearningChecklist
                          items={node.checklist ?? []}
                          readOnly={node.status !== 'in-progress' || working}
                          hideTitle
                          onToggle={(taskId) => {
                            const item = node.checklist?.find((entry) => entry.id === taskId)
                            if (item) void updateTask(node.id, taskId, !item.completed)
                          }}
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                        <p className="text-[11px] font-semibold text-slate-500">Related project</p>
                        {relatedProject ? (
                          <Link to={roadmapNodePath(relatedProject.id)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
                            <RoadmapNodeIcon node={relatedProject} size={16} />{relatedProject.title}
                          </Link>
                        ) : <p className="mt-1 text-xs text-slate-500">No related project is mapped yet.</p>}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No {visibleLabel.toLowerCase()} are available in this roadmap.</p>
        )}
      </section>
    </section>
  )
}
