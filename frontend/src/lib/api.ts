import type { RoleRecommendation, RoleSearchResult } from '../features/onboarding/types'
import { goalCopy, MOCK_ROLE_RECOMMENDATIONS } from './goalConstants'
import { profileSchema, type Profile } from '../features/onboarding/types'
import { MOCK_PROFILE } from './profileConstants'
import { validateCvFile } from './cv'

export function createEmptyProfile(): Profile {
  return { education: null, skills: [], projects: [], experience: [], certifications: [], user_confirmed: false }
}

// Mock extraction deliberately returns the reference profile for every valid CV.
export async function analyzeCv(file: File): Promise<Profile> {
  const error = validateCvFile(file)
  if (error) throw new Error(error)
  return profileSchema.parse(structuredClone(MOCK_PROFILE))
}

// Replace these mock functions with backend requests when the role API is ready.
export async function searchRoles(query: string): Promise<RoleSearchResult[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []
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
