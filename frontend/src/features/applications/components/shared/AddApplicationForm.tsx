import { useState, type FormEvent } from 'react'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, Link2, Save } from 'lucide-react'
import type { ApplicationEntry, ApplicationStatus } from '../../type'

export type NewApplicationInput = {
  company: string
  role: string
  status: ApplicationStatus
  nextStep: string
  jobUrl: string
  applicationDate: string
  jobDescription: string
}

type AddApplicationFormProps = {
  onCancel: () => void
  onSave: (application: NewApplicationInput) => void
  initialApplication?: ApplicationEntry
}

const sampleDescription = `About the role\nJoin a sample travel-data team to help turn raw data into reliable datasets for analytics. Work with engineers and analysts on supervised pipeline tasks in Bangkok. This is an illustrative internship description, not a verified live posting.\n\nResponsibilities\n• Build and maintain Python and SQL ETL pipelines.\n• Validate source data, investigate quality issues and document transformations.\n• Collaborate with analysts to deliver reusable tables and monitor scheduled jobs.\n\nRequired skills\n• Studying or recently graduated in Computer Science or a related field.\n• Python programming, SQL joins and basic relational database concepts.\n• Understanding of ETL and willingness to learn, communicate and review code.\n\nPreferred skills\n• Familiarity with Docker and version control.\n• Exposure to Spark, cloud data platforms and workflow scheduling.\n• A small data-pipeline project with clear documentation.`

const inputClassName = 'min-h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export function AddApplicationForm({ onCancel, onSave, initialApplication }: AddApplicationFormProps) {
  const [company, setCompany] = useState(initialApplication?.company ?? 'Agoda')
  const [role, setRole] = useState(initialApplication?.role ?? 'Data Engineer Intern')
  const [jobUrl, setJobUrl] = useState(initialApplication?.jobUrl ?? '')
  const [status, setStatus] = useState<ApplicationStatus>(initialApplication?.status ?? 'wishlist')
  const [applicationDate, setApplicationDate] = useState(initialApplication?.applicationDate ?? '')
  const [nextStep, setNextStep] = useState(initialApplication?.nextStep ?? 'Review the requirements and tailor my ETL project summary before applying.')
  const [jobDescription, setJobDescription] = useState(initialApplication?.jobDescription ?? sampleDescription)
  const [editingDescription, setEditingDescription] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({
      company: company.trim(),
      role: role.trim(),
      status,
      nextStep: nextStep.trim(),
      jobUrl: jobUrl.trim(),
      applicationDate,
      jobDescription: jobDescription.trim(),
    })
  }

  return (
    <section aria-labelledby="add-application-heading" className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="add-application-heading" className="text-lg font-bold text-slate-900">{initialApplication ? 'Edit Application' : 'Add Application'}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{initialApplication ? 'Update your saved tracker record.' : 'Create a personal tracker record. You can save a role before applying.'}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Personal tracker record</span>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(250px,0.85fr)_minmax(0,1.8fr)]">
        <section className="flex h-full flex-col rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BriefcaseBusiness size={18} aria-hidden="true" /></span>
            Application information
          </h3>
          <div className="mt-4 flex flex-1 flex-col gap-3.5">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Company name
              <input required value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Agoda" className={inputClassName} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Job title
              <input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Data Engineer Intern" className={inputClassName} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5"><Link2 size={13} className="text-blue-600" aria-hidden="true" />Job URL · optional</span>
              <input type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="Add a posting URL" className={inputClassName} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)} className={inputClassName}>
                <option value="wishlist">Wishlist</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
              <span className="block text-[11px] font-normal leading-relaxed text-slate-500">Options: Wishlist, Applied, Screening, Interview, Offer, Rejected, Withdrawn</span>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-blue-600" aria-hidden="true" />Application date</span>
              <input type="date" value={applicationDate} onChange={(event) => setApplicationDate(event.target.value)} className={inputClassName} />
              <span className="block text-[11px] font-normal text-slate-500">Leave blank until you send an application.</span>
            </label>
            <button type="button" onClick={onCancel} className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-100 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              <ArrowLeft size={14} aria-hidden="true" /> Cancel
            </button>
          </div>
        </section>

        <div className="flex h-full flex-col gap-3">
          <section className="flex flex-1 flex-col rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FileText size={17} aria-hidden="true" /></span>
                <div><h3 className="text-base font-bold text-slate-900">Job description</h3><p className="mt-0.5 text-xs text-slate-500">Review or edit the saved description below.</p></div>
              </div>
              {!initialApplication?.jobDescription && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Sample content</span>}
            </header>
            <div className="mt-3 flex-1 rounded-lg border border-blue-100 bg-slate-50/70 p-3 sm:p-4">
              {editingDescription ? (
                <textarea
                  autoFocus
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  aria-label="Edit job description"
                  className="min-h-[280px] w-full resize-y bg-transparent text-sm leading-relaxed text-slate-700 outline-none"
                />
              ) : (
                <div className="max-h-[390px] space-y-3 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {jobDescription.split('\n\n').map((paragraph, index) => (
                    <p key={`${index}-${paragraph.slice(0, 10)}`}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">Illustrative sample, not a verified live posting.</p>
              <button type="button" onClick={() => setEditingDescription((editing) => !editing)} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                {editingDescription ? 'Preview description' : 'Edit description'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5"><FileText size={13} className="text-blue-600" aria-hidden="true" />Notes · optional</span>
              <textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} rows={2} placeholder="Add a reminder or your notes" className="w-full resize-y rounded-lg border border-blue-100 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <footer className="mt-3 flex flex-wrap items-center gap-3">
              <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                <Save size={15} aria-hidden="true" /> {initialApplication ? 'Save Changes' : 'Save Application'}
              </button>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />Saves to your tracker. Does not submit a job application.</span>
            </footer>
          </section>
        </div>
      </form>
    </section>
  )
}
