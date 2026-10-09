export const sharedCopy = {
  brand: 'GlowJob',
  brandGlow: 'Glow',
  brandJob: 'Job',
  tagline: 'Your AI career co-pilot',
  help: 'Need help?',
  account: 'Account menu',
  avatarFallback: 'G',
} as const

export const onboardingCopy = {
  headline: 'Your brighter career\njourney starts here',
  progressLabel: 'Onboarding progress',
  stepLabel: (step: number) => `Step ${step} of 5`,
  stepAnnouncement: (step: number, label: string) => `Step ${step}: ${label}`,
  analyzingLabel: 'Between step 1 and 2',
  continue: 'Continue',
  back: 'Back',
  buildRoadmap: 'Build my roadmap',
  placeholder: 'This step is ready for the team to build.',
  steps: [
    { id: 1, label: 'Upload CV', shortLabel: 'CV' },
    { id: 2, label: 'Review Profile', shortLabel: 'Review' },
    { id: 3, label: 'Career Goal', shortLabel: 'Goal' },
    { id: 4, label: 'Preferences', shortLabel: 'Prefs' },
    { id: 5, label: 'Confirmation', shortLabel: 'Done' },
  ],
  headers: {
    1: { title: 'Let’s start with your CV', subtitle: 'Upload your CV and we’ll automatically identify your skills, education, projects, and experience.' },
    2: { title: 'Here’s what we found', subtitle: 'Review your profile before we continue.' },
    3: { title: 'Where do you want to go?', subtitle: 'Choose your target career and we’ll compare it with your current profile.' },
    4: { title: 'Make the roadmap fit your life', subtitle: 'Tell us how you prefer to learn and how much time you can realistically commit.' },
    5: { title: 'You’re all set', subtitle: 'We’ve prepared your personalized roadmap.\nYou can explore the full details inside your dashboard.' },
  },
  sidebar: {
    upload: {
      description: 'Upload your CV so our AI can understand your background and give you personalized guidance for what’s next.',
      features: [
        { title: 'AI-powered insights', description: 'We analyze your CV to uncover your unique strengths.' },
        { title: 'Personalized guidance', description: 'Get tailored career advice and next steps.' },
        { title: 'A clearer path forward', description: 'Set goals and discover new opportunities.' },
      ],
    },
    analyzing: { description: 'We’re analyzing your CV and extracting key information to build your personalized career profile.' },
    goal: {
      description: 'Tell us where you want to go and we’ll show you how to get there with personalized insights and next steps.',
      features: [
        { title: 'Personalized direction', description: 'Get AI-powered role recommendations that fit you.' },
        { title: 'Real market insights', description: 'See in-demand roles and growth opportunities.' },
        { title: 'A clearer path forward', description: 'Set a timeline and get a plan to reach your goal.' },
      ],
    },
    preferences: {
      description: 'Set your preferences so we can create a personalized and realistic roadmap that fits your life.',
      features: [
        { title: 'A plan that fits you', description: 'We tailor recommendations to your time, lifestyle, and learning preferences.' },
        { title: 'Practical and realistic', description: 'Get a roadmap that works with your current situation.' },
        { title: 'More relevant results', description: 'The more we know, the more personalized and useful your plan will be.' },
      ],
    },
    done: {
      description: 'You’re all set! Your personalized roadmap is ready to help you grow, achieve your goals, and discover new opportunities.',
      features: [
        { title: 'Personalized roadmap', description: 'AI-powered insights tailored to your unique goals.' },
        { title: 'Actionable next steps', description: 'Clear guidance to help you move forward.' },
        { title: 'More opportunities', description: 'Discover roles, skills, and paths that fit you.' },
      ],
    },
  },
} as const
