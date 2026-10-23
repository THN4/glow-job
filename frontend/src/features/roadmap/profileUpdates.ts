import type { CvProfile } from '../resume/api'

export function applyProfileUpdates(profile: CvProfile, fields: FormData): CvProfile {
  const value = (key: string) => String(fields.get(key) ?? '').trim()
  const level = value('skillLevel') || 'unknown'
  const names = [...new Set(value('skills').split(',').map((name) => name.trim()).filter(Boolean))]
  const evidenceText = value('evidence')
  if (evidenceText && !names.length) throw new Error('Enter the skill names this evidence supports.')
  const updated = structuredClone(profile)
  updated.personal = { ...updated.personal, fullName: value('fullName') || null, headline: value('headline') || null, source: 'user' }
  updated.summary = value('summary') || null
  let projectId: string | undefined
  if (value('projectName')) {
    const existing = updated.projects.find((project) => project.name?.trim().toLowerCase() === value('projectName').toLowerCase())
    projectId = existing?.id ?? crypto.randomUUID()
    const project = {
      role: null, startDate: null, endDate: null,
      ...existing, id: projectId, name: value('projectName'),
      description: value('projectDescription') || existing?.description || null,
      url: value('projectUrl') || existing?.url || null,
      technologies: existing?.technologies ?? names,
      confidence: 'high', needsReview: false, source: 'user',
    }
    if (existing) updated.projects = updated.projects.map((item) => item.id === existing.id ? project : item)
    else updated.projects.push(project)
  } else if (value('projectDescription') || value('projectUrl')) {
    throw new Error('Enter a project name to save its details.')
  }
  for (const name of names) {
    const existing = updated.technicalSkills.find((skill) => skill.name?.trim().toLowerCase() === name.toLowerCase())
    const evidence = Array.isArray(existing?.evidence) ? [...existing.evidence] as Array<Record<string, unknown>> : []
    if (evidenceText && !evidence.some((item) => item.text === evidenceText && item.itemId === (projectId ?? null))) {
      evidence.push({ evidenceType: projectId ? 'project' : 'resume_text', itemId: projectId ?? null, text: evidenceText })
    }
    const skill = {
      category: 'other', catalogMatch: null, ...existing,
      id: existing?.id ?? crypto.randomUUID(), name,
      proficiency: level === 'unknown' ? existing?.proficiency ?? 'unknown' : level,
      proficiencyBasis: level === 'unknown' ? existing?.proficiencyBasis ?? 'unknown' : 'explicit',
      evidence, confidence: 'high', needsReview: false, source: 'user',
    }
    if (existing) updated.technicalSkills = updated.technicalSkills.map((item) => item.id === existing.id ? skill : item)
    else updated.technicalSkills.push(skill)
  }
  return updated
}
