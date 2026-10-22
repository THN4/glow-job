import { getSavedProfileId, getSessionId } from '../resume/api'
import type {
  AssessmentsOverview, EntryPoint, Level, LevelCheckStart, LevelResult, LevelStep, StepCheckApplied,
  StepCheckResult, StepCheckStart, StepTask,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api').replace(/\/$/, '')

type ApiErrorBody = { error?: { code?: string; message?: string } }

export class AssessmentApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

function profilePath(): string {
  const profileId = getSavedProfileId()
  if (!profileId) throw new AssessmentApiError('Save your profile first to use skill checks.', 'NO_PROFILE')
  return `/profiles/${encodeURIComponent(profileId)}/assessments`
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = `${API_BASE}${profilePath()}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new AssessmentApiError('Could not reach the server. Check that the backend is running.', 'NETWORK')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new AssessmentApiError(body.error?.message ?? `Request failed (${response.status}).`, body.error?.code)
  }
  return (await response.json()) as T
}

export const assessmentsApi = {
  overview: () => call<AssessmentsOverview>(''),
  startStepCheck: (body: { stepKey: string; skillId?: number; tasks: StepTask[]; entryPoint: EntryPoint }) =>
    call<StepCheckStart>('/step-checks', { method: 'POST', body }),
  finishStepCheck: (id: number, answers: Array<{ itemId: number; choice: number }>) =>
    call<StepCheckResult>(`/${id}/finish`, { method: 'POST', body: { answers } }),
  applyStepCheck: (id: number, apply: boolean) =>
    call<StepCheckApplied>(`/${id}/apply`, { method: 'POST', body: { apply } }),
  startLevelCheck: (skillId: number, entryPoint: EntryPoint) =>
    call<LevelCheckStart>('/level-checks', { method: 'POST', body: { skillId, entryPoint } }),
  submitSelfCheck: (id: number, answers: Record<string, 'yes' | 'unsure' | 'no'>) =>
    call<LevelStep>(`/${id}/self-check`, { method: 'POST', body: { answers } }),
  answer: (id: number, itemId: number, choice: number) =>
    call<LevelStep>(`/${id}/answers`, { method: 'POST', body: { itemId, choice } }),
  decide: (id: number, decision: 'accepted' | 'declined') =>
    call<{ decision: string }>(`/${id}/decision`, { method: 'POST', body: { decision } }),
  quick: (body: { skillId: number; level: Level; answer: string; entryPoint: EntryPoint; stepKey?: string }) =>
    call<{ assessmentId: number }>('/quick', { method: 'POST', body }),
  get: (id: number) => call<LevelResult | StepCheckResult>(`/${id}`),
}

export const overviewKey = () => ['assessments', getSavedProfileId()] as const
