import type { SkillProfileData } from '../type'
import { roadmapSummary } from '../../roadmap/data/roadmapMockData'

export const skillProfileMockData: SkillProfileData = {
  targetRole: roadmapSummary.targetRole,
  duration: roadmapSummary.duration,
  completedSkills: [
    {
      id: 'python',
      title: 'Python',
      summary: 'Use Python to automate data tasks and build data pipelines.',
    },
    {
      id: 'sql',
      title: 'SQL',
      summary: 'Query, join, and transform data stored in relational databases.',
    },
    {
      id: 'etl-pipelines',
      title: 'ETL Pipelines',
      summary: 'Understand how to extract, transform, and load data.',
      relatedProject: { title: 'Build ETL Project', status: 'Completed' },
    },
  ],
  inProgressSkill: {
    id: 'docker',
    title: 'Docker',
    summary: 'Package data pipelines and their dependencies in containers.',
    checklist: [
      { id: 'docker-images', label: 'Understand images & containers', completed: false },
      { id: 'dockerfile', label: 'Write a Dockerfile', completed: false },
      { id: 'multi-container', label: 'Run multi-container apps', completed: false },
      { id: 'containerized-etl', label: 'Deploy containerized ETL service', completed: false },
    ],
    relatedProject: { title: 'Containerize ETL', status: 'Upcoming' },
    timing: '2 weeks at 8 hrs/week',
  },
  upcomingSkill: {
    id: 'airflow',
    title: 'Airflow',
    summary: 'Learn to schedule, monitor, and manage data workflows.',
    relatedProject: { title: 'Build Airflow DAG', status: 'Upcoming' },
  },
}
