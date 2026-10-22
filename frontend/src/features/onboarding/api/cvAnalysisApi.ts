import { extractCv, type CvProfile } from '../../resume/api'
import type { AnalysisTask, AnalysisStatus } from '../analysisTypes'
import type { Profile } from '../types'

const extractionStageToTask: Record<string, AnalysisTask> = {
  reading: 'reading',
  skills: 'skills',
  education: 'education',
  experience: 'experience',
  building: 'profile',
}

function period(startDate: string | null | undefined, endDate: string | null | undefined, isCurrent = false): string {
  const end = isCurrent ? 'Present' : endDate
  return [startDate, end].filter(Boolean).join(' – ')
}

function uniqueNames(values: Array<string | null | undefined> | null | undefined): string[] {
  const seen = new Set<string>()
  return (values ?? []).flatMap((value) => {
    const name = value?.trim()
    if (!name || seen.has(name.toLocaleLowerCase())) return []
    seen.add(name.toLocaleLowerCase())
    return [name]
  })
}

function skillLevel(value: unknown): Profile['skills'][number]['level'] {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'expert'
    ? value
    : 'unknown'
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Adapts the richer Resume API contract to the profile fields onboarding can review. */
export function toOnboardingProfile(cv: CvProfile): Profile {
  const education = cv.education[0]

  return {
    education: education ? {
      degree: education.degree ?? '',
      school: education.institution ?? '',
      period: period(education.startDate, education.endDate, education.isCurrent),
      confirmed: false,
    } : null,
    skills: cv.technicalSkills.flatMap((skill) => {
      const name = text(skill.name)?.trim() ?? ''
      if (!name) return []
      return [{ name, level: skillLevel(skill.proficiency) }]
    }).filter((skill, index, all) =>
      all.findIndex((candidate) => candidate.name.toLocaleLowerCase() === skill.name.toLocaleLowerCase()) === index,
    ),
    projects: cv.projects.map((project) => ({
      name: project.name ?? '',
      description: project.description ?? '',
      skills: uniqueNames(project.technologies),
    })),
    experience: cv.experience.map((experience) => ({
      role: experience.title ?? '',
      company: experience.organization ?? '',
      period: period(experience.startDate, experience.endDate, experience.isCurrent),
      description: experience.description ?? '',
      skills: uniqueNames(experience.technologies),
    })),
    certifications: cv.certifications.map((certification) => ({
      name: certification.name ?? '',
      details: [text(certification.issuer), text(certification.date)].filter(Boolean).join(' · '),
      outcome: text(certification.detail) ?? '',
    })),
    user_confirmed: false,
  }
}

export async function analyzeOnboardingCv(
  file: File,
  options: {
    onProgress?: (task: AnalysisTask, status: AnalysisStatus) => void
    signal?: AbortSignal
  } = {},
): Promise<{ profile: Profile; cvProfile: CvProfile }> {
  const result = await extractCv(file, (stage) => {
    const task = extractionStageToTask[stage]
    if (task) options.onProgress?.(task, 'loading')
  }, options.signal)

  return { profile: toOnboardingProfile(result.profile), cvProfile: result.profile }
}
