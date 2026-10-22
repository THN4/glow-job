import { ArrowRight, BriefcaseBusiness, ChartNoAxesCombined, Info, SearchCheck, Target } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sampleCompanyOpenings } from '../data/companyOpenings'
import { roadmapSummary } from '../../roadmap/data/roadmapMockData'
import { useRoadmapCounts } from '../../roadmap/useRoadmapCounts'
import { workspaceMarketUpdate } from '../../workspace/data/workspaceMockData'

const trackedSkills = [
  { label: 'Python', pattern: /python/i, nodeId: 'python' },
  { label: 'SQL', pattern: /sql/i, nodeId: 'sql' },
  { label: 'ETL / Pipelines', pattern: /etl|pipeline/i, nodeId: 'etl-pipelines' },
  { label: 'Cloud platforms', pattern: /cloud/i, nodeId: 'deploy-to-cloud' },
  { label: 'Docker / Containers', pattern: /docker|container/i, nodeId: 'docker' },
  { label: 'Apache Airflow', pattern: /airflow/i, nodeId: 'airflow' },
  { label: 'Apache Spark', pattern: /spark/i, nodeId: null },
  { label: 'dbt', pattern: /dbt/i, nodeId: null },
]

const statusLabel = {
  completed: 'Completed',
  'in-progress': 'In progress',
  upcoming: 'Upcoming',
} as const

export function MarketInsightsPage() {
  const { nodes } = useRoadmapCounts()
  const [selectedOccupation, setSelectedOccupation] = useState('all')
  const openingCount = sampleCompanyOpenings.length
  const frequencyOpenings = sampleCompanyOpenings.filter((opening) => selectedOccupation === 'all' || opening.role === selectedOccupation)
  const roles = [...new Set(sampleCompanyOpenings.map((opening) => opening.role))].map((role) => ({
    role,
    count: sampleCompanyOpenings.filter((opening) => opening.role === role).length,
  })).sort((first, second) => second.count - first.count)
  const skills = trackedSkills.map((skill) => ({
    ...skill,
    count: frequencyOpenings.filter((opening) =>
      [...opening.requiredSkills, ...opening.preferredSkills].some((entry) => skill.pattern.test(entry)),
    ).length,
    node: nodes.find((node) => node.id === skill.nodeId),
  })).filter((skill) => skill.count > 0).sort((first, second) => second.count - first.count)
  const nextSkills = skills.flatMap((skill) => skill.node && skill.node.status !== 'completed'
    ? [{ label: skill.label, node: skill.node }]
    : []).slice(0, 3)

  return (
    <section aria-label="Market insights" className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{roadmapSummary.targetRole} · Sample data</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">Market Insights</h1>
        <p className="mt-2 text-sm text-slate-600">Explore the roles and skills in the sample company openings, then compare them with your roadmap.</p>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p><span className="font-semibold">Illustrative snapshot.</span> {workspaceMarketUpdate.summary} These counts describe the app's sample openings, not the live job market.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><BriefcaseBusiness size={16} className="text-blue-600" aria-hidden="true" />Sample openings</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{openingCount}</p>
          <p className="mt-1 text-xs text-slate-500">The same openings shown in Companies</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><ChartNoAxesCombined size={16} className="text-violet-600" aria-hidden="true" />Role types</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{roles.length}</p>
          <p className="mt-1 text-xs text-slate-500">Represented in this sample</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><SearchCheck size={16} className="text-emerald-600" aria-hidden="true" />Skills mentioned</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{skills.length}</p>
          <p className="mt-1 text-xs text-slate-500">Tracked skill areas across the openings</p>
        </section>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Skill frequency in job postings</h2>
              <p className="mt-1 text-xs text-slate-500">Share of sample openings mentioning each skill as required or preferred; market scope is Thailand.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                Occupation
                <select
                  value={selectedOccupation}
                  onChange={(event) => setSelectedOccupation(event.target.value)}
                  className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All data &amp; analytics roles</option>
                  {roles.map(({ role }) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Retrieval scope: Thailand</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Out of {frequencyOpenings.length}</span>
            </div>
          </div>
          <div className="mt-5 space-y-5">
            {skills.map((skill, index) => {
              const percentage = frequencyOpenings.length ? Math.round((skill.count / frequencyOpenings.length) * 100) : 0
              const barColor = index < 3 ? 'bg-blue-600' : index < 6 ? 'bg-sky-500' : 'bg-sky-400'
              return (
                <div key={skill.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(120px,0.9fr)_minmax(0,1.5fr)_3.5rem]">
                  <span className="col-start-1 row-start-1 text-sm font-semibold text-slate-800">{skill.label}</span>
                  <div role="meter" aria-label={`${skill.label}: ${skill.count} of ${frequencyOpenings.length} sample job postings`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="col-span-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="col-start-2 row-start-1 text-right text-sm font-bold tabular-nums text-slate-900 sm:col-start-3">{percentage}%</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Roles in this sample</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {roles.map(({ role, count }) => (
              <div key={role} className="flex items-center justify-between gap-3 py-3 text-xs">
                <span className="font-medium text-slate-700">{role}</span>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{count}</span>
              </div>
            ))}
          </div>
          <Link to="/app/applications?tab=companies" className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">Browse Companies <ArrowRight size={14} aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Target size={17} className="text-blue-600" aria-hidden="true" />Connect this to your roadmap</h2>
          <Link to="/app/skill-profile" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">View Skill Profile <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        {nextSkills.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {nextSkills.map((skill) => (
              <Link key={skill.label} to={`/app/roadmap?node=${encodeURIComponent(skill.node.id)}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800 transition hover:border-blue-400 hover:bg-blue-50">
                <span>{skill.label}<span className="mt-1 block font-normal text-slate-500">{statusLabel[skill.node.status]} on your roadmap</span></span>
                <ArrowRight size={14} className="shrink-0 text-blue-700" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : <p className="mt-3 text-xs text-slate-600">The tracked sample skills on your roadmap are complete. Explore more roles or review your completed work.</p>}
      </section>
    </section>
  )
}
