import type { CvProfile } from '../resume/api'
import type { Profile } from './types'

export function profileFromCv(cv: CvProfile): Profile {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const education = cv.education.find((item) => text(item.degree) && text(item.institution))
  const skills = [...new Map(cv.technicalSkills.filter((item) => text(item.name)).map((item) => {
    const name = text(item.name)
    const proficiency = text(item.proficiency)
    const level = ['beginner', 'intermediate', 'advanced', 'expert'].includes(proficiency)
      ? proficiency as 'beginner' | 'intermediate' | 'advanced' | 'expert' : 'unknown' as const
    return [name.toLowerCase(), { name, level }] as const
  })).values()]
  return {
    education: education ? { degree: text(education.degree), school: text(education.institution), period: [text(education.startDate), text(education.endDate)].filter(Boolean).join(' – '), confirmed: false } : null,
    skills,
    projects: cv.projects.filter((item) => text(item.name)).map((item) => ({ name: text(item.name), description: text(item.description), skills: [] })),
    experience: cv.experience.filter((item) => text(item.title) && text(item.organization)).map((item) => ({ role: text(item.title), company: text(item.organization), period: [text(item.startDate), text(item.endDate)].filter(Boolean).join(' – '), description: text(item.description), skills: [] })),
    certifications: cv.certifications.filter((item) => text(item.name)).map((item) => ({ name: text(item.name), details: text(item.detail), outcome: '' })),
    user_confirmed: false,
  }
}

export function hasProfileInformation(profile: Profile): boolean {
  return Boolean(profile.education || profile.skills.length || profile.projects.length || profile.experience.length || profile.certifications.length)
}
