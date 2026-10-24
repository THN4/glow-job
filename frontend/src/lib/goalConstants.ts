import type { RoleRecommendation } from '../features/onboarding/types'

export const ROLE_MAX_LENGTH = 120

export const goalCopy = {
  search: {
    title: 'I already know my target role',
    description: 'Search for a role and we’ll analyze how well your profile matches.',
    label: 'Target career role',
    placeholder: 'Search for a role (e.g. Product Manager, Data Analyst, Frontend Developer)',
    submit: 'Choose this role',
    suggestions: 'Matching career roles',
    loading: 'Finding roles...',
    empty: 'No matching roles. You can use the role you entered.',
    error: 'Role suggestions are unavailable. You can still enter your target role.',
    selected: (role: string) => `Selected target role: ${role}`,
  },
  popularLabel: 'Popular roles:',
  popularRoles: ['Frontend Developer', 'Backend Developer', 'Data Analyst', 'Product Manager', 'DevOps Engineer'],
  recommendations: {
    title: 'Help me choose',
    description: 'Based on your CV, here are some roles that might be a great fit for you.',
    profileMatch: 'Profile match',
    matchPercent: (percent: number) => `${percent}%`,
    loading: 'Finding roles that fit your profile...',
    error: 'We couldn’t load role recommendations. You can still choose a target role above.',
    retry: 'Try again',
    demand: { high: 'High demand', growing: 'Growing demand', steady: 'Steady demand' },
  },
  deadline: {
    title: 'When would you like to become job-ready?',
    description: 'This helps us create a more tailored plan for you.',
    options: [
      { value: '3_months', label: '3 months', sublabel: 'I’m in a hurry' },
      { value: '6_months', label: '6 months', sublabel: 'A balanced timeline' },
      { value: '1_year', label: '1 year', sublabel: 'A more gradual plan' },
      { value: 'custom', label: 'Custom', sublabel: 'Choose a date' },
    ],
    dateLabel: 'Target job-ready date',
    dateHint: 'Select your job-ready date to continue.',
    dateRequired: 'Choose a valid date for your custom timeline.',
    datePast: 'Choose today or a future date.',
  },
  roleRequired: 'Choose or enter a target role to continue.',
  roleTooLong: 'Please keep your target role to 120 characters or fewer.',
} as const

export const MOCK_ROLE_RECOMMENDATIONS: readonly RoleRecommendation[] = [
  {
    id: 'backend', title: 'Backend Developer', category: 'development', matchPercent: 82,
    description: 'Your programming and system design skills are a strong fit.', demand: 'high',
  },
  {
    id: 'full-stack', title: 'Full Stack Developer', category: 'full_stack', matchPercent: 76,
    description: 'Builds on your existing skills with broad opportunities.', demand: 'growing',
  },
  {
    id: 'devops', title: 'DevOps Engineer', category: 'infrastructure', matchPercent: 68,
    description: 'Leverages your technical background and problem-solving skills.', demand: 'steady',
  },
]
