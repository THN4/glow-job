import type { Preferences } from '../features/onboarding/types'

export const NOTES_MAX_LENGTH = 500

export const preferencesCopy = {
  hours: {
    title: 'Weekly availability',
    description: 'How much time can you dedicate to your career development each week?',
    options: [
      { value: 'under_2', label: '< 2 hours', sublabel: 'Light' },
      { value: '2_to_5', label: '2–5 hours', sublabel: 'Moderate' },
      { value: '5_to_10', label: '5–10 hours', sublabel: 'Focused' },
      { value: 'over_10', label: '10+ hours', sublabel: 'Intensive' },
    ],
  },
  learning: {
    title: 'Learning preference',
    description: 'How do you prefer to learn new skills?',
    options: [
      { value: 'courses', label: 'Structured\ncourses' },
      { value: 'projects', label: 'Hands-on\nprojects' },
      { value: 'reading', label: 'Reading\nand articles' },
      { value: 'videos', label: 'Videos\nand tutorials' },
    ],
  },
  situation: {
    title: 'Current situation',
    description: 'Which option best describes your current situation?',
    options: [
      { value: 'student', label: 'Student' },
      { value: 'full_time', label: 'Employed\n(full-time)' },
      { value: 'part_time', label: 'Employed\n(part-time)' },
      { value: 'between_opportunities', label: 'Between\nopportunities' },
      { value: 'other', label: 'Other' },
    ],
  },
  notes: {
    title: 'Optional information',
    description: 'Is there anything else we should know to create a better plan for you? (For example: specific interests, constraints, or goals.)',
    placeholder: 'Share any additional details (optional)...',
    limitError: 'Please keep additional details to 500 characters or fewer.',
  },
  analyze: 'Analyze my career gap',
  characterCount: (length: number, limit: number) => `${length} / ${limit}`,
} as const

export const DEFAULT_PREFERENCES: Preferences = {
  hoursPerWeek: '2_to_5',
  learningStyle: 'courses',
  situation: 'full_time',
  notes: '',
}
