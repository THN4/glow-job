export type CompanyOpening = {
  id: string
  company: string
  initials: string
  role: string
  location: string
  workStyle: string
  experience: string
  description: string
  accent: 'rose' | 'emerald' | 'amber' | 'violet' | 'blue'
  jobDescription: string
  requiredSkills: string[]
  preferredSkills: string[]
  relatedSkillIds: string[]
}

export const sampleCompanyOpenings: CompanyOpening[] = [
  {
    id: 'agoda-data-engineer-intern', company: 'Agoda', initials: 'AG', role: 'Data Engineer Intern', location: 'Bangkok', workStyle: 'Hybrid', experience: 'Internship', accent: 'rose',
    description: 'A sample data-engineering internship focused on building dependable pipelines and analytics datasets.',
    jobDescription: 'Join a sample travel-data team to help turn raw data into reliable datasets for analytics. Work with engineers and analysts on supervised pipeline tasks in Bangkok. This is an illustrative internship description, not a verified live posting.',
    requiredSkills: ['Python', 'SQL', 'ETL fundamentals'], preferredSkills: ['Docker', 'Spark', 'Cloud platforms'], relatedSkillIds: ['python', 'sql', 'etl-pipelines', 'docker'],
  },
  {
    id: 'kbtg-data-engineer-intern', company: 'KBTG', initials: 'KB', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'emerald',
    description: 'A sample platform internship covering pipeline development, data validation and documentation.',
    jobDescription: 'A sample technology internship supporting data platform teams with pipeline development, data validation and documentation. Illustrative content only; not a verified live posting.',
    requiredSkills: ['Python', 'ETL', 'Data quality'], preferredSkills: ['Cloud platforms', 'Docker', 'Git'], relatedSkillIds: ['python', 'etl-pipelines', 'docker'],
  },
  {
    id: 'shopee-data-engineer-intern', company: 'Shopee', initials: 'SH', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'amber',
    description: 'A sample engineering internship focused on data transformation and reliable pipelines.',
    jobDescription: 'Support data engineering work by transforming data, maintaining reliable pipelines and partnering with analytics teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Python', 'ETL'], preferredSkills: ['Spark', 'Distributed systems', 'Cloud'], relatedSkillIds: ['sql', 'python', 'etl-pipelines'],
  },
  {
    id: 'scb-techx-data-engineer-intern', company: 'SCB TechX', initials: 'SC', role: 'Data Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'violet',
    description: 'A sample engineering internship focused on ETL workflows and analytics datasets.',
    jobDescription: 'Work with a sample engineering team on data pipelines, ETL workflows and reliable analytics datasets. Illustrative sample, not a verified live posting.',
    requiredSkills: ['Python', 'SQL', 'ETL'], preferredSkills: ['Docker', 'dbt', 'Cloud platforms'], relatedSkillIds: ['python', 'sql', 'etl-pipelines', 'docker'],
  },
  {
    id: 'central-tech-data-analyst-intern', company: 'Central Tech', initials: 'CE', role: 'Data Analyst Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'blue',
    description: 'A sample analyst internship focused on preparing data and supporting business reporting.',
    jobDescription: 'Assist analysts with data preparation, SQL queries and reporting for business teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Data analysis', 'Communication'], preferredSkills: ['BI tools', 'Dashboards', 'Python'], relatedSkillIds: ['sql', 'python'],
  },
  {
    id: 'line-man-analytics-engineer-intern', company: 'LINE MAN', initials: 'LI', role: 'Analytics Engineer Intern', location: 'Not specified', workStyle: 'Not specified', experience: 'Internship', accent: 'blue',
    description: 'A sample analytics-engineering internship focused on trusted datasets and documented transformations.',
    jobDescription: 'Help create trusted analytics datasets by transforming data, documenting models and collaborating with product teams. Illustrative sample, not a verified live posting.',
    requiredSkills: ['SQL', 'Data transformation', 'ETL'], preferredSkills: ['Data modelling', 'Airflow', 'dbt'], relatedSkillIds: ['sql', 'etl-pipelines', 'airflow'],
  },
]
