import { workspaceStyles } from '../../workspace/workspaceStyles'
import { StatusIcon } from '../../../components/StatusIcon'
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RoadmapNodeIcon } from '../../roadmap/components/RoadmapNodeIcon'
import { addSkillEvidence, deleteSkillEvidence, loadCurrentRoadmap, loadSkillEvidence, setRoadmapTask, type SkillEvidence } from '../../roadmap/api'
import { toRoadmapScreen } from '../../roadmap/adapter'
import type { RoadmapView } from '../../roadmap/api-types'
import type { RoadmapEvidence } from '../../roadmap/type'
import type { RoadmapNodeStatus } from '../../roadmap/type'
import { getSavedProfileId, getSessionId } from '../../resume/api'
import { SkillProfileHeader } from '../components/SkillProfileHeader'
import { SkillProfileStats } from '../components/SkillProfileStats'
import { LearningChecklist } from '../components/LearningChecklist'
import { LevelCheckDialog } from '../../assessments/components/LevelCheckDialog'
import { EvidenceForm } from '../../roadmap/components/EvidenceForm'
import { currentRoadmapKey, useCurrentRoadmap } from '../../roadmap/useCurrentRoadmap'

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
  const queryClient = useQueryClient()
  const roadmapQuery = useCurrentRoadmap()
  const view = roadmapQuery.data
  const loading = roadmapQuery.isPending
  const loadFailed = roadmapQuery.isError
  function setView(next: RoadmapView | null) {
    queryClient.setQueryData(currentRoadmapKey(profileId), next)
    void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
  }
  const [selectedFilter, setSelectedFilter] = useState<SkillFilter>('all')
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(() => new Set())
  const [working, setWorking] = useState(false)
  const [mutationError, setError] = useState<string | null>(null)
  const [levelCheckTarget, setLevelCheckTarget] = useState<{ skillId: number; name: string } | null>(null)
  const evidenceKey = ['skill-evidence', getSessionId(), profileId] as const
  const evidenceQuery = useQuery({
    queryKey: evidenceKey,
    queryFn: loadSkillEvidence,
    enabled: Boolean(view?.roadmapId),
  })
  const evidence = evidenceQuery.data ?? []
  const evidenceLoading = evidenceQuery.isPending && Boolean(view?.roadmapId)
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null)
  const [evidenceMutationError, setEvidenceError] = useState<string | null>(null)
  const evidenceError = evidenceMutationError ?? evidenceQuery.error?.message
  const error = mutationError ?? roadmapQuery.error?.message

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

  async function refreshRoadmap() {
    try {
      setView(await loadCurrentRoadmap())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not refresh your saved skill level.')
    }
  }

  async function saveEvidence(skillId: number, item: RoadmapEvidence) {
    setEvidenceError(null)
    const saved = await addSkillEvidence(skillId, item)
    queryClient.setQueryData<SkillEvidence[]>(evidenceKey, (current = []) => [saved, ...current])
    void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
  }

  async function removeEvidence(evidenceId: string) {
    setDeletingEvidenceId(evidenceId)
    setEvidenceError(null)
    try {
      await deleteSkillEvidence(evidenceId)
      queryClient.setQueryData<SkillEvidence[]>(evidenceKey, (current = []) => current.filter((item) => item.id !== evidenceId))
      void queryClient.invalidateQueries({ queryKey: ['progress-overview'] })
    } catch (caught) {
      setEvidenceError(caught instanceof Error ? caught.message : 'Could not delete skill evidence.')
    } finally {
      setDeletingEvidenceId(null)
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

  if (loading) return <p role="status" className={workspaceStyles.loading}>Loading your skill profile…</p>
  if (loadFailed) return (
    <section className={workspaceStyles.statePanel}>
      <h1 className={workspaceStyles.pageTitle}>Could not load your skill profile</h1>
      <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
      <button type="button" onClick={() => void roadmapQuery.refetch()} className={`mt-5 ${workspaceStyles.primaryAction}`}>Try again</button>
    </section>
  )
  if (!profileId) return (
    <section className={workspaceStyles.statePanel}>
      <h1 className={workspaceStyles.pageTitle}>Skill Profile</h1>
      <p className={workspaceStyles.stateDescription}>Save your profile and create a roadmap to see your learning progress here.</p>
      <Link to="/onboarding" className={`mt-5 ${workspaceStyles.primaryAction}`}>Start onboarding</Link>
    </section>
  )
  if (!screen) return (
    <section className={workspaceStyles.statePanel}>
      <h1 className={workspaceStyles.pageTitle}>Skill Profile</h1>
      <p className={workspaceStyles.stateDescription}>Create your roadmap to see database-backed skills, projects, and learning progress here.</p>
      <Link to="/app/roadmap" className={`mt-5 ${workspaceStyles.primaryAction}`}>Open Roadmap</Link>
    </section>
  )

  return (
    <section aria-label="Skill profile" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4">
      <SkillProfileHeader />
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {evidenceError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{evidenceError}</p>}

      <SkillProfileStats
        total={learningNodes.filter((node) => node.kind === 'skill').length}
        completed={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'completed').length}
        inProgress={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'in-progress').length}
        upcoming={learningNodes.filter((node) => node.kind === 'skill' && node.status === 'upcoming').length}
        {...projectCounts}
        selected={selectedFilter}
        onSelect={selectSkillFilter}
      />

      <section aria-live="polite" aria-label={`${visibleLabel} details`} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={workspaceStyles.sectionTitle}>{visibleLabel}</h2>
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
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[node.status]}`}><StatusIcon status={node.status} size={12} />{statusLabel[node.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                  {node.kind === 'skill' && profileLabel && <p className="mt-1 text-xs font-medium text-blue-700">Profile level: {profileLabel}</p>}

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
                        {node.skillId && (
                          <button type="button" onClick={() => setLevelCheckTarget({ skillId: node.skillId!, name: node.title })}
                            className="mt-3 min-h-9 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                            Assess skill level
                          </button>
                        )}
                        {node.skillId && (
                          <div className="mt-4 border-t border-slate-100 pt-3" data-skill-evidence>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-600">Evidence</p>
                              {evidenceLoading && <span className="text-xs text-slate-400">Loading…</span>}
                            </div>
                            <ul className="mt-2 space-y-2">
                              {evidence.filter((item) => item.skillId === node.skillId).map((item) => (
                                <li key={item.id} className="flex items-start gap-2 rounded-md bg-slate-50 p-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-800">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{item.title}</a> : item.title}</p>
                                    <p className="text-xs text-slate-500">{item.type}</p>
                                    {item.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{item.notes}</p>}
                                    {item.photo && <img src={item.photo} alt={`${item.title} evidence`} className="mt-2 max-h-28 rounded object-contain" />}
                                  </div>
                                  <button type="button" disabled={deletingEvidenceId === item.id} onClick={() => void removeEvidence(item.id)} aria-label={`Delete ${item.title} evidence`}
                                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2">
                              <EvidenceForm topic={node.title} onSave={(item) => saveEvidence(node.skillId!, item)} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                        <p className="text-xs font-semibold text-slate-500">Related project</p>
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
      {levelCheckTarget && (
        <LevelCheckDialog
          onClose={() => setLevelCheckTarget(null)}
          onDecision={(kept) => { if (kept) void refreshRoadmap() }}
          skillId={levelCheckTarget.skillId}
          skillName={levelCheckTarget.name}
          entryPoint="skill_profile"
        />
      )}
    </section>
  )
}
