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
  careerProfileId: number
  careerName: string
  title: string
  seniorityLevel: string
  summary: string
  scorePct: number | null
  totalJobs: number
  marketStatus: string
  transferableSkills: string[]
  developmentAreas: string[]
  iconTone: 'blue' | 'violet' | 'emerald'
  whyExplore: string
  supportedProfile: { skill: string; detail: string }[]
  skillsToDevelop: { skill: string; detail: string }[]
}

export type JobRecommendation = CompanyOpening & {
  scorePct: number
  semanticScorePct?: number | null
  matchedWeight: number
  totalWeight: number
  matchesGoal: boolean
  reasons: string[]
  requiredMatches: string[]
  requiredMissing: string[]
  preferredMatches: string[]
  preferredMissing: string[]
  unscoredSkills: string[]
}

export type JobRecommendationsResponse = {
  targetRole: string | null
  policy: string
  hasConfirmedSkills: boolean
  totalCandidates: number
  unscoredPostings: number
  recommendations: JobRecommendation[]
  limitations: string[]
  totalMatched: number
  filteredCount: number
  returnedCount: number
  filterOptions: {
    locations: string[]
    employmentTypes: string[]
    skills: { skillId: number; name: string }[]
  }
}

export type JobFilters = {
  sort: 'semantic' | 'coverage' | 'recent'
  location: string
  employmentType: string
  skillId: string
}
