import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowRight, ChartNoAxesCombined, Hammer, Paperclip, X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { recordRoadmapActivity } from '../activity'
import type { RoadmapNodeData } from '../type'

const STORAGE_KEY = 'glowjob:roadmap:profile-review:v1'
const suggestedSkills = ['Docker', 'Airflow', 'dbt', 'Spark', 'Tableau']

type SavedReview = {
  skills: string[]
  project: string
  notes: string
  reviewedAt: string
}

function loadReview(): SavedReview | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved: unknown = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return null
    const value = saved as Partial<SavedReview>
    return Array.isArray(value.skills) && value.skills.every((skill) => typeof skill === 'string')
      && typeof value.project === 'string' && typeof value.notes === 'string' && typeof value.reviewedAt === 'string'
      ? value as SavedReview : null
  } catch { return null }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function matchingNode(skill: string, nodes: RoadmapNodeData[]) {
  const name = skill.trim().toLowerCase()
  return nodes.find((node) => node.kind === 'skill'
    && (node.title.toLowerCase().includes(name) || name.includes(node.title.toLowerCase())))
}

export function UpdateReplanCard({ nodes, evidenceCount }: { nodes: RoadmapNodeData[]; evidenceCount: number }) {
  const [savedReview, setSavedReview] = useState(loadReview)
  const [isOpen, setIsOpen] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>(() => loadReview()?.skills ?? [])
  const [project, setProject] = useState(() => loadReview()?.project ?? '')
  const [notes, setNotes] = useState(() => loadReview()?.notes ?? '')
  const [error, setError] = useState('')
  const completedProjects = nodes.filter((node) => node.kind === 'project' && node.status === 'completed').length
  const profileSkills = nodes.filter((node) => node.kind === 'skill').length

  function addSkill(value: string, clearInput = true) {
    const name = value.trim()
    if (name && !skills.some((skill) => skill.toLowerCase() === name.toLowerCase())) setSkills((current) => [...current, name])
    if (clearInput) setSkillInput('')
    setError('')
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addSkill(skillInput)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pendingSkill = skillInput.trim()
    const submittedSkills = pendingSkill && !skills.some((skill) => skill.toLowerCase() === pendingSkill.toLowerCase())
      ? [...skills, pendingSkill] : skills
    if (!submittedSkills.length && !project.trim() && !notes.trim()) {
      setError('Add a skill, project, or note before reviewing your roadmap.')
      return
    }
    const review: SavedReview = { skills: submittedSkills, project: project.trim(), notes: notes.trim(), reviewedAt: new Date().toISOString() }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(review))
      setSavedReview(review)
      setSkills(submittedSkills)
      setSkillInput('')
      setError('')
      recordRoadmapActivity({ kind: 'replan', title: 'Reviewed profile updates against your roadmap', description: `${submittedSkills.length} skill${submittedSkills.length === 1 ? '' : 's'} added for review${review.project ? ' · project note saved' : ''}.`, nodeId: nodes.find((node) => node.status === 'in-progress')?.id ?? 'data-engineer-goal' })
    } catch {
      setError('Could not save this review in your browser. Please try again.')
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-labelledby="update-profile-title">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="update-profile-title" className="text-lg font-bold text-slate-900">Update Profile &amp; Re-plan</h2>
          <p className="mt-1 text-sm text-slate-500">{savedReview ? `Last reviewed: ${formatDate(savedReview.reviewedAt)} · Your updates are saved` : 'Last analyzed: not recorded · Your roadmap progress is saved'}</p>
        </div>
        {isOpen ? (
          <button type="button" onClick={() => { setIsOpen(false); setError('') }} className="self-start rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:text-blue-700 sm:self-auto">Cancel</button>
        ) : (
          <button type="button" onClick={() => setIsOpen(true)} aria-expanded={false} aria-controls="replan-details" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Update &amp; Re-plan <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen ? (
        <div id="replan-details" className="border-t border-slate-100 px-5 py-5 sm:px-6">
          <p className="text-sm text-slate-700">Tell us what has changed. We will compare it with your saved roadmap and suggest steps to review.</p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <label htmlFor="replan-skills" className="block text-xs font-semibold uppercase tracking-wide text-slate-800">New skills / evidence added</label>
              <input id="replan-skills" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={handleSkillKeyDown} placeholder="Type skill + Enter (e.g. Docker, Airflow...)" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              {skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills added for review">{skills.map((skill) => <button key={skill} type="button" onClick={() => setSkills((current) => current.filter((entry) => entry !== skill))} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100" aria-label={`Remove ${skill}`}>{skill}<X size={12} aria-hidden="true" /></button>)}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">{suggestedSkills.filter((skill) => !skills.some((entry) => entry.toLowerCase() === skill.toLowerCase())).map((skill) => <button key={skill} type="button" onClick={() => addSkill(skill, false)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700">+ {skill}</button>)}</div>
            </div>
            <div>
              <label htmlFor="replan-project" className="block text-xs font-semibold uppercase tracking-wide text-slate-800">Recently completed project <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></label>
              <input id="replan-project" value={project} onChange={(event) => setProject(event.target.value)} placeholder="e.g. Containerized my ETL pipeline with Docker Compose" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="replan-notes" className="block text-xs font-semibold uppercase tracking-wide text-slate-800">Anything else? <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></label>
              <textarea id="replan-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="e.g. I received feedback that I should improve my Spark knowledge" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Re-analyze my roadmap <ArrowRight size={16} aria-hidden="true" /></button>
          </form>
          {savedReview && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4" role="status">
            <h3 className="text-sm font-bold text-slate-900">Latest roadmap review</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Your updates are saved. Open matching steps to add evidence or work through their checklists.</p>
            {savedReview.skills.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{savedReview.skills.map((skill) => {
              const node = matchingNode(skill, nodes)
              return <li key={skill}>{node ? <Link to={`/app/roadmap?node=${encodeURIComponent(node.id)}`} className="inline-flex rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-400">{skill} · {node.status === 'completed' ? 'Completed' : node.status === 'in-progress' ? 'In progress' : 'Upcoming'} →</Link> : <span className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">{skill} · not on this roadmap</span>}</li>
            })}</ul>}
            {savedReview.project && <p className="mt-3 text-xs text-slate-700">Project noted: {savedReview.project}</p>}
            {savedReview.notes && <p className="mt-1 text-xs text-slate-700">Other update: {savedReview.notes}</p>}
            <p className="mt-3 text-xs text-slate-500">This review uses your saved roadmap. AI roadmap regeneration is not connected to this workspace yet.</p>
          </div>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-5 sm:grid-cols-4 sm:px-6">
          <div className="rounded-xl bg-slate-50 p-3 text-center"><Zap size={18} className="mx-auto text-blue-600" aria-hidden="true" /><p className="mt-2 text-lg font-bold text-slate-900">{profileSkills}</p><p className="text-xs text-slate-500">Roadmap skills</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-center"><Hammer size={18} className="mx-auto text-violet-600" aria-hidden="true" /><p className="mt-2 text-lg font-bold text-slate-900">{completedProjects}</p><p className="text-xs text-slate-500">Projects completed</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-center"><Paperclip size={18} className="mx-auto text-emerald-600" aria-hidden="true" /><p className="mt-2 text-lg font-bold text-slate-900">{evidenceCount}</p><p className="text-xs text-slate-500">Evidence items</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-center"><ChartNoAxesCombined size={18} className="mx-auto text-sky-600" aria-hidden="true" /><p className="mt-2 text-lg font-bold text-slate-900">—</p><p className="text-xs text-slate-500">Market scan age</p></div>
        </div>
      )}
    </section>
  )
}
