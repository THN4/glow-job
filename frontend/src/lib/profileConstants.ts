import type { Profile } from '../features/onboarding/types'

export const SKILL_MAX_LENGTH = 80
export const reviewCopy = {
  titles: { education: 'Education', skills: 'Technical Skills', projects: 'Projects', experience: 'Experience', certifications: 'Certifications / Activities', all: 'Profile' },
  edit: 'Edit',
  editProfile: 'Edit profile',
  editSection: (title: string) => `Edit ${title}`,
  dialogDescription: 'Update your information below. Your changes are saved only when you choose Save changes.',
  save: 'Save changes', cancel: 'Cancel', close: 'Close',
  continue: 'Looks good, continue',
  autofilled: 'Auto-filled from your CV',
  confirmEducation: 'Please confirm', confirmedEducation: 'Confirmed',
  manualHeader: { title: 'Let’s build your profile', subtitle: 'Add your skills and background, then review everything before we continue.' },
  empty: {
    education: 'Add your degree, school, or other education.',
    skills: 'Add the skills you’d like us to include in your profile.',
    projects: 'Add personal, academic, or professional projects.',
    experience: 'Add your work experience, internships, or freelance work.',
    certifications: 'Add certifications, workshops, or activities.',
  },
  fields: {
    degree: 'Degree or qualification', school: 'School or university', period: 'Dates',
    projectName: 'Project name', description: 'Description', technologies: 'Tools and technologies',
    role: 'Role or job title', company: 'Company or organization',
    certificationName: 'Certification or activity', details: 'Details', outcome: 'Date or achievement',
    skill: 'Skill',
  },
  add: { education: 'Add education', projects: 'Add project', experience: 'Add experience', certifications: 'Add certification or activity' },
  remove: { education: 'Remove education', projects: 'Remove project', experience: 'Remove experience', certifications: 'Remove certification or activity' },
  entryLabel: (title: string, index: number) => `${title} ${index + 1}`,
  removeEntry: (label: string, index: number) => `${label} ${index + 1}`,
  skillPlaceholder: 'Add another skill', technologyPlaceholder: 'Add a tool or technology',
  addSkill: 'Add skill', removeSkill: (skill: string) => `Remove ${skill}`,
  required: 'Please fill in this field.',
  skillLimit: 'Keep each skill to 80 characters or fewer.',
  duplicateSkill: 'This skill is already in the list.',
  uniqueSkills: 'Each skill should appear only once.',
  preparing: 'Preparing your profile...',
  profileLoadError: 'We couldn’t prepare your profile. Please try again or continue without a CV.',
} as const

export const MOCK_PROFILE: Profile = {
  education: { degree: 'B.Sc. Computer Science', school: 'Chulalongkorn University', period: '2020 – 2024', confirmed: false },
  skills: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL', 'Git', 'Docker', 'Python'],
  projects: [{
    name: 'MODNOI',
    description: 'A social platform for university students to share notes, resources, and collaborate on projects.',
    skills: ['Next.js', 'TypeScript', 'PostgreSQL', 'Vercel'],
  }],
  experience: [{
    role: 'Freelance Web Developer', company: 'Self-employed', period: 'Jun 2023 – Present',
    description: 'Build and maintain web applications for small businesses, including landing pages, e-commerce sites, and internal tools.',
    skills: ['React', 'Next.js', 'Node.js', 'Tailwind CSS'],
  }],
  certifications: [
    { name: 'AWS Workshop', details: 'AWS Cloud Practitioner Workshop', outcome: 'Mar 2024' },
    { name: 'Hackathon', details: 'CU Innovation Hackathon 2023', outcome: 'Finalist' },
    { name: 'University Competition', details: 'Chulalongkorn Programming Contest', outcome: 'Top 10' },
  ],
  user_confirmed: false,
}
