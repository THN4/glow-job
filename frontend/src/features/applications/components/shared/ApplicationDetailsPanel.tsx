import { useState } from 'react'
import { CalendarDays, FileText, Link2, MapPin, Pencil, Save, X } from 'lucide-react'
import { ApplicationStatusBadge } from './ApplicationStatusBadge'
import type { ApplicationEntry, ApplicationHistoryEntry, ApplicationStatus } from '../../type'

type ApplicationDetailsPanelProps = {
  application: ApplicationEntry
  onUpdate: (application: ApplicationEntry) => void
  onEdit: () => void
}

const statusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getHistory(application: ApplicationEntry): ApplicationHistoryEntry[] {
  if (application.statusHistory?.length) return application.statusHistory
  return [{ status: application.status, date: application.relevantDate.replace(/^(Added|Applied|Updated|Interview)\s/, ''), dateISO: application.relevantDateISO }]
}

export function ApplicationDetailsPanel({ application, onUpdate, onEdit }: ApplicationDetailsPanelProps) {
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingRejection, setEditingRejection] = useState(false)
  const [statusDraft, setStatusDraft] = useState(application.status)
  const [categoryDraft, setCategoryDraft] = useState(application.rejectionCategory ?? 'not-specified')
  const [reasonDraft, setReasonDraft] = useState(application.rejectionReason ?? '')
  const history = getHistory(application)

  function saveStatus() {
    if (statusDraft !== application.status) {
      const now = new Date()
      const dateISO = now.toISOString().slice(0, 10)
      const relevantDate = `${statusDraft === 'applied' ? 'Applied' : 'Updated'} ${formatDate(now)}`
      onUpdate({
        ...application,
        status: statusDraft,
        relevantDate,
        relevantDateISO: dateISO,
        statusHistory: [...history, { status: statusDraft, date: formatDate(now), dateISO }],
      })
    }
    setEditingStatus(false)
  }

  function saveRejection() {
    onUpdate({ ...application, rejectionCategory: categoryDraft, rejectionReason: reasonDraft.trim() })
    setEditingRejection(false)
  }

  return (
    <section aria-labelledby="application-detail-title" className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="application-detail-title" className="text-lg font-bold text-slate-900">Application Detail</h2>
          <p className="mt-0.5 text-sm text-slate-500">Review the information and status history for this saved application.</p>
        </div>
        <button type="button" onClick={onEdit} aria-label="Edit application" title="Edit application" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <Pencil size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.65fr)]">
        <section className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">{application.company}</h3>
            <p className="mt-1 text-sm font-medium text-slate-800">{application.role}</p>
            <div className="mt-2"><ApplicationStatusBadge status={application.status} /></div>
            <p className="mt-3 text-xs text-slate-500">{application.location ? `${application.location} · ` : ''}Personal saved application</p>
          </div>

          <div className="space-y-2 border-b border-slate-100 py-3 text-xs text-slate-600">
            <p><span className="font-semibold text-slate-700">Applied</span> {application.applicationDate ? formatDate(new Date(`${application.applicationDate}T00:00:00`)) : 'Not provided'}</p>
            <p><span className="font-semibold text-slate-700">Last updated</span> {application.relevantDate.replace(/^(Added|Applied|Updated|Interview)\s/, '')}</p>
            <p className="break-all"><span className="font-semibold text-slate-700">Job URL</span> {application.jobUrl || 'Not provided'}</p>
          </div>

          <div className="pt-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">Status history</h4>
              <button type="button" onClick={() => { setStatusDraft(application.status); setEditingStatus((value) => !value) }} className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                {editingStatus ? 'Cancel' : 'Update'}
              </button>
            </div>
            {editingStatus && (
              <div className="mt-2 flex gap-2">
                <select aria-label="New application status" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as ApplicationStatus)} className="min-h-9 min-w-0 flex-1 rounded-lg border border-blue-100 px-2 text-xs">
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" onClick={saveStatus} className="rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Save</button>
              </div>
            )}
            <ol className="mt-2 space-y-2">
              {history.map((entry, index) => (
                <li key={`${entry.dateISO}-${entry.status}-${index}`} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-blue-300 bg-white" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium capitalize text-slate-800">{entry.status}</span><span className="text-[11px] text-slate-500">{entry.date}</span></span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-3">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><FileText size={13} className="text-blue-600" aria-hidden="true" />User-entered notes</h4>
            <p className="mt-1.5 min-h-16 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 text-xs leading-relaxed text-slate-600">{application.nextStep || 'No notes added.'}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">This note is your own entry, not an inferred application outcome.</p>
          </div>
        </section>

        <div className="space-y-3">
          <section className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FileText size={16} aria-hidden="true" /></span>Saved job description</h3>
            <div className="mt-3 whitespace-pre-line rounded-lg border border-blue-100 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-600">
              {application.jobDescription || 'No job description was saved with this application.'}
            </div>
          </section>

          {application.status === 'rejected' && (
            <section className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="text-base font-bold text-slate-900">Rejection details</h3><p className="mt-1 text-xs text-slate-500">Record only what you know. No reason is inferred.</p></div>
                <button type="button" onClick={() => { setCategoryDraft(application.rejectionCategory ?? 'not-specified'); setReasonDraft(application.rejectionReason ?? ''); setEditingRejection((value) => !value) }} aria-label={editingRejection ? 'Cancel rejection details edit' : 'Edit rejection details'} title={editingRejection ? 'Cancel rejection details edit' : 'Edit rejection details'} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{editingRejection ? <X size={15} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}</button>
              </div>
              <label className="mt-3 block space-y-1.5 text-xs font-semibold text-slate-800">Category
                <select disabled={!editingRejection} value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} className="min-h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-xs font-normal text-slate-700 disabled:bg-slate-50">
                  <option value="not-specified">Not Specified</option><option value="skill-gap">Skill Gap</option><option value="experience">Experience</option><option value="interview">Interview</option><option value="position-filled">Position Filled</option><option value="other">Other</option>
                </select>
              </label>
              <p className="mt-1 text-[10px] text-slate-500">Options: Skill Gap · Experience · Interview · Position Filled · Not Specified</p>
              <label className="mt-3 block space-y-1.5 text-xs font-semibold text-slate-800">Reason details · user-entered
                <textarea disabled={!editingRejection} value={reasonDraft} onChange={(event) => setReasonDraft(event.target.value)} rows={3} placeholder="Add details only if you choose to record a reason" className="w-full resize-y rounded-lg border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-rose-300 disabled:bg-slate-50" />
              </label>
              {editingRejection && <button type="button" onClick={saveRejection} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"><Save size={13} aria-hidden="true" />Save rejection details</button>}
            </section>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-slate-500">
            {application.jobUrl && <a href={application.jobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-blue-700 hover:underline"><Link2 size={12} aria-hidden="true" />Open original job posting</a>}
            {application.applicationDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" />Saved on {formatDate(new Date(`${application.applicationDate}T00:00:00`))}</span>}
            {!application.jobUrl && !application.applicationDate && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />Only applications you add appear in this tracker.</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
