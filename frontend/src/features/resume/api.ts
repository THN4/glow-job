const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api').replace(/\/$/, '')
const SESSION_ID_KEY = 'glowjob.anonymous.sessionId'
const PROFILE_ID_KEY = 'glowjob.anonymous.profileId'

export type CvItem = {
  id: string
  name?: string | null
  title?: string | null
  organization?: string | null
  institution?: string | null
  degree?: string | null
  fieldOfStudy?: string | null
  description?: string | null
  summary?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  isCurrent?: boolean
  technologies?: string[]
  highlights?: string[]
  [key: string]: unknown
}

export type CvProfile = {
  schemaVersion: number
  personal: {
    fullName: string | null
    headline: string | null
    email: string | null
    phone: string | null
    location: string | null
    links: Array<{ label: string; url: string }>
    confidence: string
    needsReview: boolean
    source: 'cv' | 'user'
    [key: string]: unknown
  }
  summary: string | null
  education: CvItem[]
  technicalSkills: CvItem[]
  softSkills: CvItem[]
  experience: CvItem[]
  projects: CvItem[]
  certifications: CvItem[]
  tools: CvItem[]
  languages: CvItem[]
  derived?: Record<string, unknown> | null
}

export type ExtractionResult = {
  profile: CvProfile
  meta: { reviewCount: number; warnings: string[]; [key: string]: unknown }
}

export type CareerProfileOption = {
  careerProfileId: number
  careerName: string
  profileName: string
  seniorityLevel: string
}

export type CareerMatchResult = {
  careerProfileId: number
  marketWindow: { startDate: string; endDate: string } | null
  marketSample: { totalJobs: number; lastUpdated: string | null }
  status: string
  scores: {
    coreSkillMatchPct: number | null
    marketSkillCoveragePct: number | null
    proficiencyAlignmentPct: number | null
    assessmentCoveragePct: number | null
  }
  skillSummary: { considered: number; coreConsidered: number; coreCovered: number; covered: number; missingFromProfile: number; notAssessed: number; marketDataInsufficient: number; excludedMarketSkills: number }
  coreSkillPolicy: { version: string; nominalLimit: number; includedCount: number }
  skills: Array<{
    skillId: number
    skillName: string
    weightedDemandScore: number | null
    marketTargetLevel: string | null
    userProficiencyLevel: string | null
    proficiencyBasis: string | null
    demandPercentage: number
    status: string
    reasonCode: string
    isCoreSkill: boolean
    coreRank: number | null
    gapScore: number | null
    priorityScore: number | null
    priorityRank: number | null
    requiresConfirmation: boolean
    evidence: Array<{ text?: string; source?: string; [key: string]: unknown }>
  }>
  unmatchedUserSkills: Array<{ rawSkillName: string; matchStatus: string }>
  warnings: string[]
}

export type SavedCareerGoal = {
  goalId: number
  careerId: number
  careerProfileId: number
  targetRoleTitle: string
  readinessTimeframe: string
  targetDate: string | null
  weeklyAvailability: string
  availableHoursPerWeek: number | null
  preferredLearningStyle: string
  additionalContext: string | null
  updatedAt: string
}

type ApiErrorBody = { error?: { code?: string; message?: string; retryable?: boolean } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('ติดต่อ Backend ไม่ได้ ตรวจว่า Backend กำลังทำงานและตั้ง VITE_API_BASE_URL ถูกต้อง', { cause: error })
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(body.error?.message ?? `คำขอไม่สำเร็จ (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** The saved anonymous profile ID, or null before the profile is saved. */
export function getSavedProfileId(): string | null {
  try { return localStorage.getItem(PROFILE_ID_KEY) }
  catch { return null }
}

export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

/** Start a distinct anonymous profile for a fresh onboarding run. */
export function startNewAnonymousProfileSession(): void {
  localStorage.setItem(SESSION_ID_KEY, crypto.randomUUID())
  localStorage.removeItem(PROFILE_ID_KEY)
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
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

export async function extractCv(file: File, onStage: (stage: string) => void, signal?: AbortSignal): Promise<ExtractionResult> {
  const upload = await request<{ uploadId: string; upload: { method: string; url: string; headers?: Record<string, string>; fields?: Record<string, string> } }>('/cv/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/pdf', size: file.size }),
    signal,
  })

  if (upload.upload.method === 'PUT') {
    await request<void>(new URL(upload.upload.url).pathname.replace(/^\/api/, ''), {
      method: 'PUT',
      headers: upload.upload.headers ?? { 'Content-Type': file.type },
      body: file,
      signal,
    })
  } else if (upload.upload.method === 'POST' && upload.upload.fields) {
    const form = new FormData()
    Object.entries(upload.upload.fields).forEach(([key, value]) => form.append(key, value))
    form.append('file', file)
    const response = await fetch(upload.upload.url, { method: 'POST', body: form, signal })
    if (!response.ok) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ')
  } else {
    throw new Error('รูปแบบการอัปโหลดจาก Backend ไม่รองรับ')
  }

  const started = await request<{ jobId: string }>('/cv/extractions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: upload.uploadId, sessionId: getSessionId() }),
    signal,
  })
  const startedAt = Date.now()
  while (Date.now() - startedAt < 300_000) {
    await wait(1500, signal)
    const job = await request<{ status: string; stage?: string; result?: ExtractionResult; error?: { message?: string } }>(`/cv/extractions/${encodeURIComponent(started.jobId)}`, {
      headers: { 'X-Session-Id': getSessionId() },
      signal,
    })
    if (job.stage) onStage(job.stage)
    if (job.status === 'succeeded' && job.result) return job.result
    if (job.status === 'failed') throw new Error(job.error?.message ?? 'สกัดข้อมูลจาก CV ไม่สำเร็จ')
  }
  throw new Error('ใช้เวลาสกัดนานเกินไป กรุณาลองใหม่')
}

export async function saveProfile(profile: CvProfile): Promise<{ profileId: string; updatedAt: string }> {
  const profileId = localStorage.getItem(PROFILE_ID_KEY)
  const saved = await request<{ profileId: string; updatedAt: string }>('/profiles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), profileId, profile }),
  })
  localStorage.setItem(PROFILE_ID_KEY, saved.profileId)
  return saved
}

export type CareerGoalPreferences = {
  targetRole: string
  deadline: '3_months' | '6_months' | '1_year' | 'custom'
  customDeadlineDate: string | null
  hoursPerWeek: 'under_2' | '2_to_5' | '5_to_10' | 'over_10'
  learningStyle: 'courses' | 'projects' | 'reading' | 'videos'
  situation: 'student' | 'full_time' | 'part_time' | 'between_opportunities' | 'other'
  notes: string
}

export async function saveCareerGoal(goal: CareerGoalPreferences): Promise<void> {
  const profileId = localStorage.getItem(PROFILE_ID_KEY)
  if (!profileId) throw new Error('ไม่พบโปรไฟล์ที่บันทึกไว้ กรุณากลับไปยืนยันโปรไฟล์ก่อน')
  await request<{ saved: boolean }>(`/profiles/${encodeURIComponent(profileId)}/career-goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify(goal),
  })
}

/** Persist the selected market career profile alongside the preferences captured in onboarding. */
export async function saveMatchedCareerGoal(goal: {
  careerProfileId: number
  targetRoleTitle: string
  readinessTimeframe: 'three_months' | 'six_months' | 'one_year' | 'no_fixed_deadline'
  targetDate: string | null
  weeklyAvailability: 'under_2_hours' | 'hours_2_to_5' | 'hours_5_to_10' | 'hours_10_plus'
  availableHoursPerWeek: number
  preferredLearningStyle: 'structured_courses' | 'hands_on_projects' | 'reading_articles' | 'videos_tutorials'
  additionalContext: string
}): Promise<void> {
  const profileId = localStorage.getItem(PROFILE_ID_KEY)
  if (!profileId) throw new Error('ไม่พบโปรไฟล์ที่บันทึกไว้ กรุณากลับไปยืนยันโปรไฟล์ก่อน')
  await request<{ goal: SavedCareerGoal }>(`/profiles/${encodeURIComponent(profileId)}/goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify(goal),
  })
}

export async function loadSavedProfile(): Promise<{ profileId: string; profile: CvProfile } | null> {
  const profileId = localStorage.getItem(PROFILE_ID_KEY)
  if (!profileId) return null
  try {
    return await request(`/profiles/${encodeURIComponent(profileId)}`)
  } catch {
    return null
  }
}

export async function loadCareerProfiles(): Promise<CareerProfileOption[]> {
  const result = await request<{ careerProfiles: CareerProfileOption[] }>('/career-profiles')
  return result.careerProfiles
}

export async function loadCareerMatch(profileId: string, careerProfileId: number): Promise<CareerMatchResult> {
  return request<CareerMatchResult>(`/profiles/${encodeURIComponent(profileId)}/career-match?careerProfileId=${careerProfileId}`, {
    headers: { 'X-Session-Id': getSessionId() },
  })
}

/** Load the saved onboarding target and calculate its current market scores. */
export async function loadSavedCareerMatch(): Promise<{ goal: SavedCareerGoal; match: CareerMatchResult } | null> {
  const profileId = localStorage.getItem(PROFILE_ID_KEY)
  if (!profileId) return null
  const result = await request<{ goal: SavedCareerGoal | null }>(`/profiles/${encodeURIComponent(profileId)}/goal`, {
    headers: { 'X-Session-Id': getSessionId() },
  })
  if (!result.goal) return null
  const match = await loadCareerMatch(profileId, result.goal.careerProfileId)
  return { goal: result.goal, match }
}
