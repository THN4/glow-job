import { getSavedProfileId, getSessionId, loadCareerProfiles, saveCareerGoal } from '../resume/api'
import type { CareerGoalPreferences } from '../resume/api'
import type { CareerGoal, CareerGoalInput, ProgressStatus, RoadmapJob, RoadmapView } from './api-types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api').replace(/\/$/, '')

type ApiErrorBody = { error?: { message?: string } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'X-Session-Id': getSessionId(), ...init.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('ติดต่อ Backend ไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่', { cause: error })
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(body.error?.message ?? `คำขอไม่สำเร็จ (${response.status})`)
  }
  return (await response.json()) as T
}

function profileId(): string {
  const id = getSavedProfileId()
  if (!id) throw new Error('ไม่พบโปรไฟล์ที่บันทึกไว้ กรุณากลับไปยืนยันโปรไฟล์ก่อน')
  return encodeURIComponent(id)
}

export async function loadRoadmapGoal(signal?: AbortSignal): Promise<CareerGoal | null> {
  if (!getSavedProfileId()) return null
  const result = await request<{ goal: CareerGoal | null }>(`/profiles/${profileId()}/goal`, { signal })
  return result.goal
}

export async function saveRoadmapGoal(goal: CareerGoalPreferences): Promise<void> {
  const careers = await loadCareerProfiles()
  const chosen = goal.targetRole.trim().toLocaleLowerCase()
  const matches = careers.filter((career) =>
    career.profileName.trim().toLocaleLowerCase() === chosen)
  if (matches.length !== 1) {
    const supported = [...new Set(careers.map((career) => career.profileName))].join(', ')
    throw new Error(`Roadmap รองรับอาชีพที่มีในระบบก่อน กรุณาเลือกชื่อให้ตรงกับ: ${supported}`)
  }
  const body: CareerGoalInput = {
    careerProfileId: matches[0].careerProfileId,
    targetRoleTitle: goal.targetRole.trim(),
    readinessTimeframe: {
      '3_months': 'three_months', '6_months': 'six_months', '1_year': 'one_year', custom: 'no_fixed_deadline',
    }[goal.deadline] as CareerGoalInput['readinessTimeframe'],
    targetDate: goal.deadline === 'custom' ? goal.customDeadlineDate : null,
    weeklyAvailability: {
      under_2: 'under_2_hours', '2_to_5': 'hours_2_to_5', '5_to_10': 'hours_5_to_10', over_10: 'hours_10_plus',
    }[goal.hoursPerWeek] as CareerGoalInput['weeklyAvailability'],
    availableHoursPerWeek: null,
    preferredLearningStyle: {
      courses: 'structured_courses', projects: 'hands_on_projects',
      reading: 'reading_articles', videos: 'videos_tutorials',
    }[goal.learningStyle] as CareerGoalInput['preferredLearningStyle'],
    additionalContext: goal.notes.trim() || null,
  }
  await saveCareerGoal(goal)
  await request(`/profiles/${profileId()}/goal`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function loadCurrentRoadmap(signal?: AbortSignal): Promise<RoadmapView | null> {
  const id = getSavedProfileId()
  if (!id) return null
  let response: Response
  try {
    response = await fetch(`${API_BASE}/profiles/${encodeURIComponent(id)}/roadmaps/current`, {
      headers: { 'X-Session-Id': getSessionId() }, signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('ติดต่อ Backend ไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่', { cause: error })
  }
  if (response.status === 404) {
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    if (body.error?.code === 'ROADMAP_NOT_FOUND') return null
    throw new Error(body.error?.message ?? 'ไม่พบโปรไฟล์')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(body.error?.message ?? `คำขอไม่สำเร็จ (${response.status})`)
  }
  const body = (await response.json()) as { roadmap: RoadmapView }
  return body.roadmap
}

export async function generateRoadmap(onStage: (stage: RoadmapJob['stage']) => void,
                                      signal?: AbortSignal, force = false): Promise<RoadmapView> {
  const id = profileId()
  const started = await request<RoadmapJob>(`/profiles/${id}/roadmaps`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }), signal,
  })
  onStage(started.stage)
  const startedAt = Date.now()
  let job = started
  while (Date.now() - startedAt < 300_000) {
    if (job.status === 'failed') throw new Error(job.error?.message ?? 'สร้าง roadmap ไม่สำเร็จ')
    if (job.status === 'succeeded') {
      const roadmap = await loadCurrentRoadmap(signal)
      if (!roadmap) throw new Error('สร้าง roadmap แล้วแต่ไม่พบข้อมูลที่บันทึกไว้')
      return roadmap
    }
    await wait(2000, signal)
    job = await request<RoadmapJob>(`/roadmap-jobs/${encodeURIComponent(started.jobId)}`, { signal })
    onStage(job.stage)
  }
  throw new Error('ใช้เวลาสร้าง roadmap นานเกินไป กรุณาลองใหม่')
}

export async function setRoadmapTask(roadmapId: number, taskId: string,
                                     completed: boolean): Promise<RoadmapView> {
  const result = await request<{ roadmap: RoadmapView }>(
    `/profiles/${profileId()}/roadmaps/${roadmapId}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) },
  )
  return result.roadmap
}

export async function setRoadmapStep(roadmapId: number, stepKey: string,
                                     status: ProgressStatus): Promise<RoadmapView> {
  const result = await request<{ roadmap: RoadmapView }>(
    `/profiles/${profileId()}/roadmaps/${roadmapId}/steps/${encodeURIComponent(stepKey)}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
  )
  return result.roadmap
}
