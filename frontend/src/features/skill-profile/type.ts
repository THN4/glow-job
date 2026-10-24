export type SkillProfileSkill = {
  id: string
  title: string
  summary: string
  checklist?: SkillChecklistItem[]
  relatedProject?: {
    title: string
    status: string
  }
  timing?: string
}

export type SkillChecklistItem = {
  id: string
  label: string
  completed: boolean
}

export type SkillEvidenceSource = 'GitHub project' | 'Certificate' | 'Self report'

export type SkillProfileData = {
  targetRole: string
  duration: string
  completedSkills: SkillProfileSkill[]
  inProgressSkill: SkillProfileSkill
  upcomingSkill: SkillProfileSkill
}
