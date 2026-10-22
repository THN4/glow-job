export const CV_MAX_SIZE = 10 * 1024 * 1024
export const CV_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'

export const uploadCopy = {
  dropTitle: 'Drop your CV here',
  browsePrefix: 'or',
  browse: 'click to browse',
  replace: 'click to replace your CV',
  dropNow: 'Release to select your CV',
  fileHint: 'PDF, JPG, PNG, WEBP · Max 10 MB',
  fileInputLabel: 'Choose a CV file',
  upload: 'Upload CV',
  skip: 'Continue without CV',
  remove: 'Remove CV',
  privacy: 'Your CV is only used to build your career profile.',
  errors: {
    type: 'Please choose a PDF, JPG, PNG, or WEBP file.',
    size: 'The file must be 10 MB or smaller.',
    empty: 'This file is empty. Please choose a CV with content.',
    multiple: 'Please upload one CV at a time.',
  },
  fileSize: (bytes: number) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : bytes >= 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${bytes} bytes`,
  find: {
    title: 'What we’ll find',
    description: 'Review and edit the information in your career profile, including:',
    items: [
      { category: 'education', color: 'green', title: 'Education', description: 'Degrees, schools, and fields of study' },
      { category: 'skills', color: 'purple', title: 'Technical skills', description: 'Programming languages, frameworks and more' },
      { category: 'experience', color: 'blue', title: 'Work experience', description: 'Roles, companies, and achievements' },
      { category: 'projects', color: 'pink', title: 'Projects', description: 'Personal, academic, and professional projects' },
      { category: 'certifications', color: 'amber', title: 'Certifications', description: 'Professional certifications and licenses' },
      { category: 'tools', color: 'teal', title: 'Tools & technologies', description: 'Software, platforms, and tools you use' },
    ],
  },
} as const
