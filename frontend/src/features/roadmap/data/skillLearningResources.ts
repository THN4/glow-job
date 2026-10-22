import type { RoadmapChecklistItem } from '../type'
import type { LearningSource } from '../learningSources'

type SkillLearningResources = {
  sources: LearningSource[]
  checklist: RoadmapChecklistItem[]
}

const airflowUrl = 'https://airflow.apache.org/docs/apache-airflow/stable/tutorial/fundamentals.html'

// Curated official documentation; these are summaries, not retrieved RAG results.
export const skillLearningResources: Record<string, SkillLearningResources> = {
  airflow: {
    sources: [
      { id: 'first-workflow', title: 'Airflow 101: Building Your First Workflow', url: airflowUrl, summary: 'An introduction to creating a workflow with tasks, scheduling, and dependencies.' },
      { id: 'dag', title: 'Airflow 101 › What is a Dag?', url: `${airflowUrl}#what-is-a-dag`, summary: 'A DAG describes workflow tasks and the dependencies that determine their execution order.' },
      { id: 'operators', title: 'Airflow 101 › Understanding Operators', url: `${airflowUrl}#understanding-operators`, summary: 'Operators define the work performed by tasks, such as running a shell command.' },
    ],
    checklist: [
      { id: 'airflow-intro', label: 'Study: Build your first workflow', completed: false, kind: 'learn', sourceId: 'first-workflow' },
      { id: 'airflow-dag', label: 'Study: What is a DAG?', completed: false, kind: 'learn', sourceId: 'dag' },
      { id: 'airflow-operators', label: 'Study: Understand operators', completed: false, kind: 'learn', sourceId: 'operators' },
      { id: 'airflow-practice', label: 'Practice: Run a small Airflow workflow', completed: false, kind: 'practice', sourceId: 'first-workflow' },
    ],
  },
  docker: {
    sources: [{ id: 'docker-overview', title: 'Docker › What is Docker?', url: 'https://docs.docker.com/get-started/docker-overview/', summary: 'Containers package applications and their dependencies into consistent, isolated environments.' }],
    checklist: [
      { id: 'docker-platform', label: 'Study: Containers and the Docker platform', completed: false, kind: 'learn', sourceId: 'docker-overview' },
      { id: 'docker-architecture', label: 'Study: Images, containers, and registries', completed: false, kind: 'learn', sourceId: 'docker-overview' },
      { id: 'docker-practice', label: 'Practice: Run your ETL script in a container', completed: false, kind: 'practice', sourceId: 'docker-overview' },
    ],
  },
  python: {
    sources: [{ id: 'python-tutorial', title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/', summary: 'Learn Python syntax, control flow, functions, data structures, and modules through examples.' }],
    checklist: [],
  },
  sql: {
    sources: [{ id: 'sql-tutorial', title: 'PostgreSQL › The SQL Language', url: 'https://www.postgresql.org/docs/current/tutorial-sql.html', summary: 'Follow tutorials on tables, queries, joins, aggregate functions, and updating data.' }],
    checklist: [
      { id: 'sql-queries', label: 'Study: Querying a table', completed: false, kind: 'learn', sourceId: 'sql-tutorial' },
      { id: 'sql-joins', label: 'Study: Joins and aggregate functions', completed: false, kind: 'learn', sourceId: 'sql-tutorial' },
      { id: 'sql-practice', label: 'Practice: Write a query combining two tables', completed: false, kind: 'practice', sourceId: 'sql-tutorial' },
    ],
  },
}
