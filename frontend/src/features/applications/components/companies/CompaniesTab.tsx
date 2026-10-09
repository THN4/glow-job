import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { CompanyOpeningDetail } from './CompanyOpeningDetail'

export type CompanyOpening = {
  id: string
  company: string
  initials: string
  role: string
  location: string
  workStyle: string
  experience: string
  description: string
  accent: 'rose' | 'emerald' | 'amber' | 'violet' | 'blue'
  jobDescription: string
  requiredSkills: string[]
  preferredSkills: string[]
}

const openings: CompanyOpening[] = [
  {
    id: 'agoda-data-engineer-intern', company: 'Agoda', initials: 'AG', role: 'Data Engineer Intern', location: 'Bangkok', workStyle: 'Hybrid', experience: 'Internship', accent: 'rose',
    description: 'Python, SQL and ETL foundations appear in your profile. Docker is developing; Spark and cloud exposure may be gaps.',
    jobDescription: 'Join a sample travel-data team to help turn raw data into reliable datasets for analytics. Work with engineers and analysts on supervised pipeline tasks in Bangkok. This is an illustrative internship description, not a verified live posting.',
    requiredSkills: ['Python', 'SQL', 'ETL fundamentals'], preferredSkills: ['Docker', 'Spark', 'Cloud platforms'],
  },
  {
    id: 'kbtg-data-engineer-intern', company: 'KBTG', initials: 'KB', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'emerald',
    description: 'Completed Python and ETL learning relates to pipeline tasks. Cloud platform practice is not yet evidenced.',
    jobDescription: 'A sample technology internship supporting data platform teams with pipeline development, data validation and documentation. Illustrative content only; not a verified live posting.',
    requiredSkills: ['Python', 'ETL', 'Data quality'], preferredSkills: ['Cloud platforms', 'Docker', 'Git'],
  },
  {
    id: 'shopee-data-engineer-intern', company: 'Shopee', initials: 'SH', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'amber',
    description: 'SQL and ETL foundations support data transformation work. Spark and distributed-processing experience may be gaps.',
    jobDescription: 'Support data engineering work by transforming data, maintaining reliable pipelines and partnering with analytics teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Python', 'ETL'], preferredSkills: ['Spark', 'Distributed systems', 'Cloud'],
  },
  {
    id: 'scb-techx-data-engineer-intern', company: 'SCB TechX', initials: 'SC', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'violet',
    description: 'Your completed ETL project connects to data-pipeline tasks. Docker remains in progress; dbt is not in your profile.',
    jobDescription: 'Work with a sample engineering team on data pipelines, ETL workflows and reliable analytics datasets. Illustrative sample, not a verified live posting.',
    requiredSkills: ['Python', 'SQL', 'ETL'], preferredSkills: ['Docker', 'dbt', 'Cloud platforms'],
  },
  {
    id: 'central-tech-data-analyst-intern', company: 'Central Tech', initials: 'CE', role: 'Data Analyst Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'blue',
    description: 'SQL learning supports querying and preparing data. BI tools and dashboard practice are development areas.',
    jobDescription: 'Assist analysts with data preparation, SQL queries and reporting for business teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Data analysis', 'Communication'], preferredSkills: ['BI tools', 'Dashboards', 'Python'],
  },
  {
    id: 'line-man-analytics-engineer-intern', company: 'LINE MAN', initials: 'LI', role: 'Analytics Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'blue',
    description: 'SQL and ETL foundations transfer to analytics datasets. Data modelling and orchestration need further practice.',
    jobDescription: 'Help create trusted analytics datasets by transforming data, documenting models and collaborating with product teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Data transformation', 'ETL'], preferredSkills: ['Data modelling', 'Airflow', 'dbt'],
  },
]

const accentClasses: Record<CompanyOpening['accent'], string> = {
  rose: 'border-rose-200 bg-rose-50 text-rose-600',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
}

type CompaniesTabProps = {
  applications: { company: string; role: string }[]
  selectedOpening: CompanyOpening | null
  onAddOpening: (opening: CompanyOpening) => void
  onSelectedOpeningChange: (opening: CompanyOpening | null) => void
}

export function CompaniesTab({ applications, selectedOpening, onAddOpening, onSelectedOpeningChange }: CompaniesTabProps) {
  const [role, setRole] = useState('all')
  const [location, setLocation] = useState('all')
  const [experience, setExperience] = useState('Internship')

  if (selectedOpening) {
    const alreadySaved = applications.some((application) => application.company === selectedOpening.company && application.role === selectedOpening.role)
    return <CompanyOpeningDetail opening={selectedOpening} alreadySaved={alreadySaved} onAddToApplications={() => onAddOpening(selectedOpening)} />
  }

  const filteredOpenings = openings.filter((opening) =>
    (role === 'all' || opening.role === role)
    && (location === 'all' || opening.location === location)
    && (experience === 'all' || opening.experience === experience),
  )

  return (
    <section aria-label="Companies and sample job openings" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="sr-only" htmlFor="company-role-filter">Role</label>
        <select id="company-role-filter" value={role} onChange={(event) => setRole(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Role: All data roles</option><option>Data Engineer Intern</option><option>Data Analyst Intern</option><option>Analytics Engineer Intern</option>
        </select>
        <label className="sr-only" htmlFor="company-location-filter">Location</label>
        <select id="company-location-filter" value={location} onChange={(event) => setLocation(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Location: All locations</option><option>Bangkok</option><option>Not specified</option>
        </select>
        <label className="sr-only" htmlFor="company-experience-filter">Experience</label>
        <select id="company-experience-filter" value={experience} onChange={(event) => setExperience(event.target.value)} className="min-h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400">
          <option value="all">Experience: All levels</option><option>Internship</option>
        </select>
      </div>

      {filteredOpenings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOpenings.map((opening) => (
            <article key={opening.id} className={`flex min-h-40 flex-col rounded-xl border bg-white p-3 shadow-sm ${accentClasses[opening.accent].split(' ').filter((token) => token.startsWith('border-')).join(' ')}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${accentClasses[opening.accent].split(' ').filter((token) => token.startsWith('bg-') || token.startsWith('text-')).join(' ')}`}>{opening.initials}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{opening.company}</h3><p className="truncate text-xs font-medium text-slate-700">{opening.role}</p></div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500"><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{opening.location} · {opening.workStyle} · {opening.experience}</p>
              <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600">{opening.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => onSelectedOpeningChange(opening)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">View Job <ArrowRight size={13} aria-hidden="true" /></button>
                <span className="text-[10px] text-slate-400">App job database · Sample</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-slate-500">No sample openings match these filters.</p>
      )}
      <p className="text-[10px] leading-relaxed text-slate-500">Illustrative database content, not verified live postings. Nothing enters My Applications until you review and save it.</p>
    </section>
  )
}
