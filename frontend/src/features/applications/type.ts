export type ApplicationStatus =
  | 'wishlist'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'

export type ApplicationStatusFilter = ApplicationStatus | 'all' | 'in-progress'

export type ApplicationEntry = {
  id: string
  company: string
  role: string
  status: ApplicationStatus
  relevantDate: string
  relevantDateISO: string
  nextStep: string
  jobUrl?: string
  applicationDate?: string
  jobDescription?: string
  location?: string
  statusHistory?: ApplicationHistoryEntry[]
  rejectionCategory?: string
  rejectionReason?: string
  jobId?: string | null
}

export type CompanyOpening = {
  id: string
  jobId: number
  company: string
  role: string
  location: string
  workStyle: string
  experience: string
  description: string
  accent: 'blue'
  jobDescription: string
  requiredSkills: string[]
  preferredSkills: string[]
  publisher: string
  sourceUrl: string
  postedAt: string | null
}

export type ApplicationHistoryEntry = {
  status: ApplicationStatus
  date: string
  dateISO: string
}

export type ApplicationTabKey = 'my-applications' | 'recommendations' | 'companies'
export type ApplicationDateFilter = 'all' | '30-days' | 'this-year'

export type CareerPathRecommendation = {
  id: string
  title: string
  summary: string
  transferableSkills: string[]
  developmentAreas: string[]
  iconTone: 'blue' | 'violet' | 'emerald'
  whyExplore: string
  supportedProfile: { skill: string; detail: string }[]
  skillsToDevelop: { skill: string; detail: string }[]
}
