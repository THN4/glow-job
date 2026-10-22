import type { CvItem, CvProfile } from '../../resume/api'
import type { Profile } from '../types'

function meta(original?: CvItem) {
  return { id: crypto.randomUUID(), confidence: 'high', ...original, source: 'user', needsReview: false }
}

function dates(value: string, original?: CvItem) {
  const originalPeriod = [original?.startDate, original?.isCurrent ? 'Present' : original?.endDate].filter(Boolean).join(' – ')
  if (value === originalPeriod) return { startDate: original?.startDate ?? null, endDate: original?.endDate ?? null, isCurrent: original?.isCurrent ?? false }
  const parts = value.trim().split(/\s+[–—-]\s+/)
  const date = (part?: string) => part && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(part) ? part : null
  const isCurrent = /^(present|current|ปัจจุบัน)$/i.test(parts[parts.length - 1] ?? '')
  return { startDate: date(parts[0]), endDate: isCurrent ? null : date(parts[1]), isCurrent }
}

/** Keep CV-only fields while applying the fields shown in the review form. */
export function toSavedCvProfile(profile: Profile, original?: CvProfile): CvProfile {
  const education = profile.education
  return {
    schemaVersion: 1,
    personal: original?.personal ?? { fullName: null, headline: null, email: null, phone: null, location: null, links: [], confidence: 'high', needsReview: false, source: 'user' },
    summary: original?.summary ?? null,
    softSkills: original?.softSkills ?? [],
    tools: original?.tools ?? [],
    languages: original?.languages ?? [],
    education: education ? [{
      fieldOfStudy: null, gpa: null, description: null,
      ...meta(original?.education[0]), degree: education.degree, institution: education.school,
      ...dates(education.period, original?.education[0]),
    }, ...(original?.education.slice(1) ?? [])] : [],
    technicalSkills: profile.skills.map((skill) => {
      const previous = original?.technicalSkills.find((item) => item.name?.toLowerCase() === skill.name.toLowerCase())
      return { category: 'other', ...meta(previous), name: skill.name,
        proficiency: skill.level ?? 'unknown', proficiencyBasis: skill.level && skill.level !== 'unknown' ? 'explicit' : 'unknown' }
    }),
    projects: profile.projects.map((project) => ({
      role: null, url: null, startDate: null, endDate: null,
      ...meta(original?.projects.find((item) => item.name === project.name)),
      name: project.name, description: project.description, technologies: project.skills,
    })),
    experience: profile.experience.map((experience) => {
      const previous = original?.experience.find((item) => item.title === experience.role && item.organization === experience.company)
      return { employmentType: null, location: null, highlights: [], ...meta(previous),
        title: experience.role, organization: experience.company, description: experience.description,
        technologies: experience.skills, ...dates(experience.period, previous) }
    }),
    certifications: profile.certifications.map((certification) => {
      const previous = original?.certifications.find((item) => item.name === certification.name)
      const previousDetails = [previous?.issuer, previous?.date].filter(Boolean).join(' · ')
      return { kind: 'certification', issuer: null, date: null, ...meta(previous),
        name: certification.name, detail: certification.outcome,
        ...(certification.details === previousDetails ? {} : { issuer: certification.details || null, date: null }) }
    }),
  }
}
