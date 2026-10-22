import type { RoleRecommendation, RoleSearchResult } from '../features/onboarding/types'
import { loadCareerProfiles } from '../features/resume/api'
import { goalCopy, MOCK_ROLE_RECOMMENDATIONS } from './goalConstants'
import { profileSchema, type Profile } from '../features/onboarding/types'
import { MOCK_PROFILE } from './profileConstants'
import { validateCvFile } from './cv'
import type { AnalysisProgress, AnalysisTask } from '../features/onboarding/analysisTypes'
import { DEMO_ANALYSIS_STEP_MIN_MS } from './analysisConstants'

let cachedCareerTitles: string[] | null = null
let careerTitlesRequest: Promise<string[]> | null = null

function loadCareerTitles(): Promise<string[]> {
  if (cachedCareerTitles) return Promise.resolve(cachedCareerTitles)
  if (!careerTitlesRequest) {
    careerTitlesRequest = loadCareerProfiles().then((profiles) => {
      const titles = [...new Set(profiles.map(({ careerName }) => careerName))]
      cachedCareerTitles = titles
      return titles
    }).catch((error: unknown) => {
      careerTitlesRequest = null
      throw error
    })
  }
  return careerTitlesRequest
}

function waitForDemoStep(duration: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  if (duration <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, duration)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function createEmptyProfile(): Profile {
  return { education: null, skills: [], projects: [], experience: [], certifications: [], user_confirmed: false }
}

// Demo adapter: reads the real file, then prepares the reference profile.
// Replace each operation with a backend task/event when the analysis API is ready.
// Demo tasks remain visible briefly; success still requires the operation to finish.
export async function analyzeCv(file: File, options: { onProgress?: AnalysisProgress; signal?: AbortSignal } = {}): Promise<Profile> {
  const { onProgress, signal } = options
  async function run<T>(task: AnalysisTask, action: () => T | Promise<T>): Promise<T> {
    signal?.throwIfAborted()
    const startedAt = performance.now()
    onProgress?.(task, 'loading')
    // Let React paint the current task before synchronous text processing.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    try {
      signal?.throwIfAborted()
      const result = await action()
      await waitForDemoStep(DEMO_ANALYSIS_STEP_MIN_MS - (performance.now() - startedAt), signal)
      signal?.throwIfAborted()
      onProgress?.(task, 'done')
      return result
    } catch (error) {
      if (!signal?.aborted) onProgress?.(task, 'error')
      throw error
    }
  }
  await run('reading', async () => {
    const error = validateCvFile(file)
    if (error) throw new Error(error)
    const buffer = await file.arrayBuffer()
    if (buffer.byteLength !== file.size) throw new Error('Incomplete CV read')
  })
  const skills = await run('skills', () => profileSchema.shape.skills.parse(structuredClone(MOCK_PROFILE.skills)))
  const education = await run('education', () => profileSchema.shape.education.parse(structuredClone(MOCK_PROFILE.education)))
  const sections = await run('experience', () => profileSchema.pick({ projects: true, experience: true, certifications: true })
    .parse(structuredClone({ projects: MOCK_PROFILE.projects, experience: MOCK_PROFILE.experience, certifications: MOCK_PROFILE.certifications })))
  return run('profile', () => profileSchema.parse({ ...createEmptyProfile(), skills, education, ...sections }))
}

export async function searchRoles(query: string): Promise<RoleSearchResult[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []
  try {
    const careerNames = await loadCareerTitles()
    return careerNames.filter((title) => title.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 6).map((title) => ({ id: title.toLocaleLowerCase().replaceAll(' ', '-'), title }))
  } catch {
    // Keep free text and local suggestions available when the market catalog is offline.
  }
  const titles = [...new Set([
    ...goalCopy.popularRoles,
    ...MOCK_ROLE_RECOMMENDATIONS.map((role) => role.title),
  ])]
  return titles.filter((title) => title.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 6).map((title) => ({ id: title.toLocaleLowerCase().replaceAll(' ', '-'), title }))
}

export async function getRoleRecommendations(): Promise<RoleRecommendation[]> {
  return MOCK_ROLE_RECOMMENDATIONS.map((role) => ({ ...role }))
}
