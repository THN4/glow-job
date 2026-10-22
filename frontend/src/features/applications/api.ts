import { getSavedProfileId, getSessionId } from '../resume/api'
import type { ApplicationEntry, ApplicationStatus, CompanyOpening } from './type'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api').replace(/\/$/, '')

export type ApplicationInput = {
  company: string
  role: string
  status: ApplicationStatus
  nextStep: string
  jobUrl?: string
  applicationDate?: string
  jobDescription?: string
  location?: string
  rejectionCategory?: string | null
  rejectionReason?: string
}

type ApiErrorBody = { error?: { code?: string; message?: string } }

export class ApplicationsApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApplicationsApiError'
    this.code = code
  }
}

function profilePath(): string {
  const profileId = getSavedProfileId()
  if (!profileId) throw new ApplicationsApiError('Save your profile first to use Applications.', 'NO_PROFILE')
  return `/profiles/${encodeURIComponent(profileId)}/applications`
}

async function call<T>(path = '', init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${profilePath()}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApplicationsApiError('Could not reach the server. Check that the backend is running.', 'NETWORK')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApplicationsApiError(body.error?.message ?? `Request failed (${response.status}).`, body.error?.code)
  }
  return (await response.json()) as T
}

async function publicCall<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`)
  } catch {
    throw new ApplicationsApiError('Could not reach the server. Check that the backend is running.', 'NETWORK')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApplicationsApiError(body.error?.message ?? `Request failed (${response.status}).`, body.error?.code)
  }
  return (await response.json()) as T
}

export const applicationsApi = {
  list: async () => (await call<{ applications: ApplicationEntry[] }>()).applications,
  jobPostings: async () => (await publicCall<{ jobPostings: CompanyOpening[] }>('/job-postings')).jobPostings,
  create: (input: ApplicationInput) => call<ApplicationEntry>('', { method: 'POST', body: input }),
  saveJobPosting: (jobId: number) => call<ApplicationEntry>('/from-job', { method: 'POST', body: { jobId } }),
  update: (id: string, input: ApplicationInput) =>
    call<ApplicationEntry>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
}

export const applicationsKey = () => ['applications', getSavedProfileId()] as const
