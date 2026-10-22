import type { CareerPathRecommendation } from '../type'

export const careerPathRecommendations: CareerPathRecommendation[] = [
  {
    id: 'analytics-engineer',
    title: 'Analytics Engineer',
    summary: 'Your SQL and ETL learning can transfer to reliable analytics datasets.',
    transferableSkills: ['SQL', 'Python', 'ETL foundations'],
    developmentAreas: ['dbt', 'dimensional modelling', 'cloud warehouses', 'data testing'],
    iconTone: 'blue',
    whyExplore: 'Your SQL, Python and ETL roadmap connects to the foundations of analytics engineering. The next step is to learn modelling and testing—not to assume a job match.',
    supportedProfile: [
      { skill: 'SQL', detail: 'A foundation for querying and transforming analytics data.' },
      { skill: 'Python', detail: 'Useful for ingestion scripts and repeatable data tasks.' },
      { skill: 'ETL foundations', detail: 'These learning milestones connect to transformation workflows.' },
    ],
    skillsToDevelop: [
      { skill: 'dbt', detail: 'Learn model organisation, dependencies, documentation and version-controlled transformations.' },
      { skill: 'Dimensional modelling', detail: 'Practise facts, dimensions and consistent metric definitions with a small star schema.' },
      { skill: 'Cloud warehouses and testing', detail: 'Learn warehouse basics, data-quality tests and reliable deployment. No cloud proficiency is assumed.' },
    ],
  },
  {
    id: 'bi-developer',
    title: 'BI Developer',
    summary: 'SQL foundations and computer-science study support a path into reporting.',
    transferableSkills: ['SQL', 'Data transformation', 'CS education'],
    developmentAreas: ['Dashboard design', 'BI tools', 'Business metrics', 'Stakeholder discovery'],
    iconTone: 'violet',
    whyExplore: 'Your SQL foundation and data-transformation learning can support reporting workflows. Dashboard design, business metrics and communicating insights are areas to explore next.',
    supportedProfile: [
      { skill: 'SQL', detail: 'Useful for preparing clean reporting datasets.' },
      { skill: 'Data transformation', detail: 'ETL learning gives you practice shaping raw data for downstream use.' },
    ],
    skillsToDevelop: [
      { skill: 'Dashboard design', detail: 'Practise choosing clear visuals and layouts for a defined audience.' },
      { skill: 'BI tools', detail: 'Build a small report in a BI tool and document how the data is prepared.' },
      { skill: 'Business metrics', detail: 'Learn to define measures consistently and validate them with stakeholders.' },
    ],
  },
  {
    id: 'python-backend-developer',
    title: 'Python Backend Developer',
    summary: 'Python learning and freelance web-development experience support this direction.',
    transferableSkills: ['Python', 'Web development', 'Problem solving'],
    developmentAreas: ['Python APIs', 'Automated testing', 'Authentication', 'Service deployment'],
    iconTone: 'emerald',
    whyExplore: 'Your Python roadmap provides a starting point for backend work. To explore this path, deepen API design, testing, security and deployment through a small service project.',
    supportedProfile: [
      { skill: 'Python', detail: 'A starting foundation for scripts and services.' },
    ],
    skillsToDevelop: [
      { skill: 'Python APIs', detail: 'Build a REST API with clear request validation and documented endpoints.' },
      { skill: 'Automated testing', detail: 'Add unit and integration tests for expected behavior and failure cases.' },
      { skill: 'Authentication and deployment', detail: 'Practise safe authentication patterns and deploy a small service with monitoring.' },
    ],
  },
]
