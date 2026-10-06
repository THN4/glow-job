import { z } from 'zod'
import { NOTES_MAX_LENGTH, preferencesCopy } from '../../lib/preferencesConstants'
import { goalCopy, ROLE_MAX_LENGTH } from '../../lib/goalConstants'
import { reviewCopy, SKILL_MAX_LENGTH } from '../../lib/profileConstants'

export const skillSchema = z.string().trim().min(1, reviewCopy.required).max(SKILL_MAX_LENGTH, reviewCopy.skillLimit)
export const skillsSchema = z.array(skillSchema).refine(
  (skills) => new Set(skills.map((skill) => skill.toLowerCase())).size === skills.length,
  reviewCopy.uniqueSkills,
)
const requiredText = z.string().trim().min(1, reviewCopy.required)
const optionalText = z.string().trim()

export const profileSchema = z.object({
  education: z.object({ degree: requiredText, school: requiredText, period: optionalText, confirmed: z.boolean() }).nullable(),
  skills: skillsSchema,
  projects: z.array(z.object({ name: requiredText, description: optionalText, skills: skillsSchema })),
  experience: z.array(z.object({ role: requiredText, company: requiredText, period: optionalText, description: optionalText, skills: skillsSchema })),
  certifications: z.array(z.object({ name: requiredText, details: optionalText, outcome: optionalText })),
  user_confirmed: z.boolean(),
})
export type Profile = z.infer<typeof profileSchema>
export type ProfileSection = 'education' | 'skills' | 'projects' | 'experience' | 'certifications'

export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export type Deadline = '3_months' | '6_months' | '1_year' | 'no_deadline'

export type RoleSearchResult = { id: string; title: string }

export type RoleRecommendation = RoleSearchResult & {
  category: 'development' | 'full_stack' | 'infrastructure'
  matchPercent: number
  description: string
  demand: 'high' | 'growing' | 'steady'
}

export const careerGoalSchema = z.object({
  targetRole: z.string().trim().min(1, goalCopy.roleRequired).max(ROLE_MAX_LENGTH, goalCopy.roleTooLong),
  deadline: z.enum(['3_months', '6_months', '1_year', 'no_deadline']),
})

export type OnboardingData = {
  cvFile: File | null
  targetRole: string
  deadline: Deadline
  preferences: Preferences
  profile: Profile
  profileSource: 'cv' | 'manual'
}

export const preferencesSchema = z.object({
  hoursPerWeek: z.enum(['under_2', '2_to_5', '5_to_10', 'over_10']),
  learningStyle: z.enum(['courses', 'projects', 'reading', 'videos']),
  situation: z.enum(['student', 'full_time', 'part_time', 'between_opportunities', 'other']),
  notes: z.string().max(NOTES_MAX_LENGTH, preferencesCopy.notes.limitError),
})

export type Preferences = z.infer<typeof preferencesSchema>
