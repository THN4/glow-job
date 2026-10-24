import type { CvProfile } from '../resume/api'
import type { TechnicalSkill } from '../onboarding/types'
import { createUuid } from '../../lib/uuid.ts'

export function applyProfileUpdates(profile: CvProfile, fields: FormData, skills: TechnicalSkill[]): CvProfile {
  const value = (key: string) => String(fields.get(key) ?? '').trim()
  const skillUpdates = skills.map((skill) => ({ ...skill, name: skill.name.trim() }))
  const names = skillUpdates.map((skill) => skill.name)
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error('Each skill should appear only once.')
  }
  for (const skill of skillUpdates) {
    if (!skill.name) throw new Error('Enter a name for each skill.')
    if (!skill.level) throw new Error(`Choose a proficiency level for ${skill.name}.`)
  }
  const evidenceText = value('evidence')
  if (evidenceText && !names.length) throw new Error('Enter the skill names this evidence supports.')
  const updated = structuredClone(profile)
  let projectId: string | undefined
  if (value('projectName')) {
    const existing = updated.projects.find((project) => project.name?.trim().toLowerCase() === value('projectName').toLowerCase())
    projectId = existing?.id ?? createUuid()
    const project = {
      role: null, startDate: null, endDate: null,
      ...existing, id: projectId, name: value('projectName'),
      description: value('projectDescription') || existing?.description || null,
      url: value('projectUrl') || existing?.url || null,
      technologies: [...new Set([...(existing?.technologies ?? []), ...names])],
      confidence: 'high', needsReview: false, source: 'user',
    }
    if (existing) updated.projects = updated.projects.map((item) => item.id === existing.id ? project : item)
    else updated.projects.push(project)
  } else if (value('projectDescription') || value('projectUrl')) {
    throw new Error('Enter a project name to save its details.')
  }
  for (const { name, level } of skillUpdates) {
    const existing = updated.technicalSkills.find((skill) => skill.name?.trim().toLowerCase() === name.toLowerCase())
    const evidence = Array.isArray(existing?.evidence) ? [...existing.evidence] as Array<Record<string, unknown>> : []
    if (evidenceText && !evidence.some((item) => item.text === evidenceText && item.itemId === (projectId ?? null))) {
      evidence.push({ evidenceType: projectId ? 'project' : 'resume_text', itemId: projectId ?? null, text: evidenceText })
    }
    const skill = {
      category: 'other', catalogMatch: null, ...existing,
      id: existing?.id ?? createUuid(), name,
      proficiency: level,
      proficiencyBasis: level === 'unknown' ? 'unknown' : 'explicit',
      evidence, confidence: 'high', needsReview: false, source: 'user',
    }
    if (existing) updated.technicalSkills = updated.technicalSkills.map((item) => item.id === existing.id ? skill : item)
    else updated.technicalSkills.push(skill)
  }
  return updated
}
