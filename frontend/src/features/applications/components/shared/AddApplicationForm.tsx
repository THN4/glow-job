import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Link2,
  Pencil,
  Save,
} from "lucide-react";
import type { ApplicationEntry, ApplicationStatus } from "../../type";

export type NewApplicationInput = {
  company: string;
  role: string;
  status: ApplicationStatus;
  nextStep: string;
  jobUrl: string;
  applicationDate: string;
  jobDescription: string;
};

type AddApplicationFormProps = {
  onCancel: () => void;
  onSave: (application: NewApplicationInput) => void;
  initialApplication?: ApplicationEntry;
};

const sampleDescription = `About the role\nJoin a sample travel-data team to help turn raw data into reliable datasets for analytics. Work with engineers and analysts on supervised pipeline tasks in Bangkok. This is an illustrative internship description, not a verified live posting.\n\nResponsibilities\nโ€ข Build and maintain Python and SQL ETL pipelines.\nโ€ข Validate source data, investigate quality issues and document transformations.\nโ€ข Collaborate with analysts to deliver reusable tables and monitor scheduled jobs.\n\nRequired skills\nโ€ข Studying or recently graduated in Computer Science or a related field.\nโ€ข Python programming, SQL joins and basic relational database concepts.\nโ€ข Understanding of ETL and willingness to learn, communicate and review code.\n\nPreferred skills\nโ€ข Familiarity with Docker and version control.\nโ€ข Exposure to Spark, cloud data platforms and workflow scheduling.\nโ€ข A small data-pipeline project with clear documentation.`;

const inputClassName =
  "min-h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function AddApplicationForm({
  onCancel,
  onSave,
  initialApplication,
}: AddApplicationFormProps) {
  const [company, setCompany] = useState(
    initialApplication?.company ?? "Agoda",
  );
  const [role, setRole] = useState(
    initialApplication?.role ?? "Data Engineer Intern",
  );
  const [jobUrl, setJobUrl] = useState(initialApplication?.jobUrl ?? "");
  const [status, setStatus] = useState<ApplicationStatus>(
    initialApplication?.status ?? "wishlist",
  );
  const [applicationDate, setApplicationDate] = useState(
    initialApplication?.applicationDate ?? "",
  );
  const [nextStep, setNextStep] = useState(
    initialApplication?.nextStep ??
      "Review the requirements and tailor my ETL project summary before applying.",
  );
  const [jobDescription, setJobDescription] = useState(
    initialApplication?.jobDescription ?? sampleDescription,
  );
  const [editingDescription, setEditingDescription] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      company: company.trim(),
      role: role.trim(),
      status,
      nextStep: nextStep.trim(),
      jobUrl: jobUrl.trim(),
      applicationDate,
      jobDescription: jobDescription.trim(),
    });
  }

  return (
    <section aria-labelledby="add-application-heading" className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="add-application-heading"
            className="text-lg font-bold text-slate-900"
          >
            {initialApplication ? "Edit Application" : "Add Application"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {initialApplication
              ? "Update your saved tracker record."
              : "Create a personal tracker record. You can save a role before applying."}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          Personal tracker record
        </span>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="application-form-layout">
          <section aria-labelledby="application-information-heading" className="application-form-info">
          <h3
            id="application-information-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BriefcaseBusiness size={18} aria-hidden="true" />
            </span>
            Application information
          </h3>
            <div className="mt-4 grid gap-3.5">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Company name
              <input
                required
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Agoda"
                className={inputClassName}
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Job title
              <input
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="e.g. Data Engineer Intern"
                className={inputClassName}
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Link2 size={13} className="text-blue-600" aria-hidden="true" />
                Job URL · optional
              </span>
              <input
                type="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="Add a posting URL"
                className={inputClassName}
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ApplicationStatus)
                }
                className={inputClassName}
              >
                <option value="wishlist">Wishlist</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <CalendarDays
                  size={13}
                  className="text-blue-600"
                  aria-hidden="true"
                />
                Application date
              </span>
              <input
                type="date"
                value={applicationDate}
                onChange={(event) => setApplicationDate(event.target.value)}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

          <section aria-labelledby="job-description-heading" className="application-form-description">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FileText size={17} aria-hidden="true" />
              </span>
              <div>
                <h3
                  id="job-description-heading"
                  className="text-base font-bold text-slate-900"
                >
                  Job description
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review or edit the saved description below.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!initialApplication?.jobDescription && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  Sample content
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingDescription((editing) => !editing)}
                aria-label={
                  editingDescription
                    ? "Preview description"
                    : "Edit description"
                }
                title={
                  editingDescription
                    ? "Preview description"
                    : "Edit description"
                }
                className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {editingDescription ? (
                  <Eye size={15} aria-hidden="true" />
                ) : (
                  <Pencil size={14} aria-hidden="true" />
                )}
              </button>
            </div>
          </header>
          <div className="mt-3 rounded-lg border border-blue-100 bg-slate-50/70 p-3 sm:p-4">
            {editingDescription ? (
              <textarea
                autoFocus
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                aria-label="Edit job description"
                className="min-h-[360px] w-full resize-y bg-transparent text-sm leading-relaxed text-slate-700 outline-none"
              />
            ) : (
              <div className="min-h-[360px] max-h-[390px] space-y-3 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {jobDescription.split("\n\n").map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 10)}`}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Illustrative sample, not a verified live posting.
          </p>
        </section>
        </div>

        <div className="my-5 border-t border-blue-200" aria-hidden="true" />

        <section
          aria-labelledby="application-notes-heading"
          className="pt-1"
        >
          <label
            htmlFor="application-notes"
            className="block space-y-1.5 text-xs font-semibold text-slate-800"
          >
            <span
              id="application-notes-heading"
              className="flex items-center gap-1.5"
            >
              <FileText
                size={13}
                className="text-blue-600"
                aria-hidden="true"
              />
              Notes · optional
            </span>
            <textarea
              id="application-notes"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              rows={2}
              placeholder="Add a reminder or your notes"
              className="w-full resize-y rounded-lg border border-blue-100 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </section>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2
              size={13}
              className="text-emerald-600"
              aria-hidden="true"
            />
            Saves to your tracker. Does not submit a job application.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-blue-100 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Save size={15} aria-hidden="true" />{" "}
              {initialApplication ? "Save Changes" : "Save Application"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
