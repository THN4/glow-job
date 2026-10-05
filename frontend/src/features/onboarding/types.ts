export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export type Timeline =
  | '1_month'
  | '3_months'
  | '6_months'
  | '1_year'
  | '2_years'

export type CurrentStatus =
  | 'cs_student'
  | 'bootcamp_graduate'
  | 'career_switcher'
  | 'recent_graduate'
  | 'self_taught'

export type OnboardingData = {
  cvFileName: string | null
  targetRole: string
  timeline: Timeline | null
  currentStatus: CurrentStatus | null
  hoursPerWeek: number | null
}