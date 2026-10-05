import { useState } from 'react'
import {
  Award,
  BriefcaseBusiness,
  Code2,
  FileText,
  FolderKanban,
  GraduationCap,
  ShieldCheck,
  Upload,
  Wrench,
} from 'lucide-react'

type UploadCvStepProps = {
  fileName: string | null
  onFileSelected: (fileName: string) => void
  onContinueWithoutCv: () => void
}

const informationTypes = [
  { icon: GraduationCap, title: 'Education', description: 'Degrees, schools, and fields of study' },
  { icon: Code2, title: 'Technical skills', description: 'Programming languages and frameworks' },
  { icon: BriefcaseBusiness, title: 'Work experience', description: 'Roles, companies, and achievements' },
  { icon: FolderKanban, title: 'Projects', description: 'Personal, academic, and professional projects' },
  { icon: Award, title: 'Certifications', description: 'Professional certifications and licenses' },
  { icon: Wrench, title: 'Tools & technologies', description: 'Software, platforms, and tools you use' },
]

export function UploadCvStep({
  fileName,
  onFileSelected,
  onContinueWithoutCv,
}: UploadCvStepProps) {
  const [error, setError] = useState<string | null>(null)
  const fileInputId = 'cv-upload-input'

  function handleFile(file?: File) {
    if (!file) return

    const hasAllowedExtension = /\.(pdf|doc|docx)$/i.test(file.name)

    if (!hasAllowedExtension) {
      setError('Please choose a PDF, DOC, or DOCX file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The file must be 10 MB or smaller.')
      return
    }

    setError(null)
    onFileSelected(file.name)
  }

  return (
    <section>
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Let’s start with your CV
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Upload your CV and we’ll identify your skills, education, projects,
          and experience.
        </p>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <label
            htmlFor={fileInputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              handleFile(event.dataTransfer.files[0])
            }}
            className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-5 py-6 text-center transition hover:bg-blue-50"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FileText size={26} aria-hidden="true" />
            </span>

            <span className="mt-3 font-semibold text-slate-900">
              {fileName ?? 'Drop your CV here'}
            </span>
            <span className="mt-1 text-sm text-blue-600">
              or click to browse
            </span>
            <span className="mt-3 text-xs text-slate-500">
              PDF, DOC, DOCX · Max 10 MB
            </span>
          </label>

          <input
            id={fileInputId}
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(event) => handleFile(event.currentTarget.files?.[0])}
          />

          <label
            htmlFor={fileInputId}
            className="mx-auto mt-3 flex min-h-11 w-full max-w-60 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Upload size={16} aria-hidden="true" />
            Upload CV
          </label>

          {error && (
            <p className="mt-2 text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onContinueWithoutCv}
            className="mx-auto mt-3 block min-h-10 px-3 text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            Continue without CV
          </button>

          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={16} aria-hidden="true" />
            Your CV is only used to build your career profile.
          </p>
        </div>

        <aside className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h2 className="font-semibold text-slate-900">What we’ll find</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Our AI can organize information from your CV, including:
          </p>

          <ul className="mt-4 space-y-3">
            {informationTypes.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-slate-600">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}