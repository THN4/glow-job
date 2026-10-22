export const DEMO_ANALYSIS_STEP_MIN_MS = 1200

export const analysisCopy = {
  header: {
    title: 'Analyzing your CV',
    subtitle: 'We’re preparing a career profile for you to review before we continue.',
  },
  readyHeader: {
    title: 'Your profile is ready',
    subtitle: 'All tasks are complete. Continue when you’re ready to review your profile.',
  },
  steps: [
    { id: 'reading', title: 'Reading your CV', description: 'Reading and checking your selected file…' },
    { id: 'skills', title: 'Identifying skills', description: 'Extracting technical skills from your CV…' },
    { id: 'education', title: 'Extracting education', description: 'Reading education details from your CV…' },
    { id: 'experience', title: 'Understanding projects & experience', description: 'Extracting work history, projects, and certifications…' },
    { id: 'profile', title: 'Building your profile', description: 'Validating and putting everything together…' },
  ],
  status: { pending: 'Waiting', loading: 'In progress', done: 'Complete', error: 'Failed' },
  progress: 'CV analysis progress',
  completed: (count: number, total: number) => `${count} of ${total} tasks complete`,
  timingTitle: 'You can continue once your profile is ready.',
  timingDescription: 'Processing time depends on your file. You’ll review everything before we continue. Leaving this screen stops waiting, but may not stop a job already running on the backend.',
  readyTitle: 'Everything is ready for your review.',
  readyDescription: 'Choose Continue to review and edit your profile.',
  demoNotice: 'We’ll analyze your CV and prepare information for you to review before continuing.',
  reviewNotice: 'Review the extracted information and correct anything missing or inaccurate before continuing.',
  errorTitle: 'We couldn’t finish analyzing your CV',
  retry: 'Try again',
  cancel: 'Stop waiting and return to upload',
  manual: 'Continue without CV',
  errors: {
    generic: 'Please try again, choose another file, or enter your information manually.',
  },
  illustration: { cv: 'CV', education: 'Education', skills: 'Skills', experience: 'Experience', projects: 'Projects' },
} as const
