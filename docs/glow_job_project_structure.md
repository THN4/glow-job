# Glow-Job Project Structure

## 1. Overview

This document outlines the Glow-Job repository so each role has clear folder ownership.

A single monorepo suits this small team because the components need to integrate quickly. The trees below describe the proposed structure. The root folders are scaffolded; frontend and docs/db already contain content.

Top-level structure:

```text
glow-job/
│
├── frontend/
├── backend/
├── ai/
├── rag/
├── data/
├── shared/
├── infra/
├── tests/
├── docs/
├── migrations/
├── scripts/
├── .github/
│
├── .env.example
├── docker-compose.yml
├── README.md
└── requirements / package files
```

---

# 2. Role Ownership

## Data & RAG Engineer

Primary ownership:

```text
data/
rag/
shared/contracts/market/
shared/contracts/rag/
```

Responsibilities:

- Job ingestion
- Job cleaning
- Company normalization
- Career mapping
- Skill extraction
- Skill normalization
- Market aggregation
- Knowledge ingestion
- Chunking
- Embedding
- Retrieval
- Skill dependency
- RAG output contract

---

## AI / Agent Engineer

Primary ownership:

```text
ai/
shared/contracts/agent/
shared/mock/agent_input.json
shared/mock/agent_output.json
```

Responsibilities:

- Skill Gap
- Priority Engine
- Best Next Action
- Agent orchestration
- Roadmap generation
- Re-planning
- Prompt / tool logic
- AI output contract

---

## Backend Engineer

Primary ownership:

```text
backend/
shared/contracts/api/
```

Responsibilities:

- API
- App DB
- User account
- Resume upload
- Resume extraction integration
- Profile ingestion
- Roadmap persistence
- Progress API
- Integration among the app, AI, and RAG components

---

## Frontend / Product Engineer

Primary ownership:

```text
frontend/
shared/types/
```

Responsibilities:

- Onboarding
- Resume upload
- Auto-fill
- User profile
- Skill Gap page
- Roadmap page
- Progress update
- Re-plan UI
- API integration

---

## Cloud / Integration / QA Engineer

Primary ownership:

```text
infra/
tests/integration/
scripts/deploy/
```

Responsibilities:

- AWS infrastructure
- S3
- RDS
- Lambda
- API Gateway
- Environment / secrets
- Deployment
- Integration test
- End-to-end test
- Demo environment

---

# 3. Recommended Project Structure

```text
glow-job/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── onboarding/
│   │   │   ├── resume/
│   │   │   ├── profile/
│   │   │   ├── skill-gap/
│   │   │   ├── roadmap/
│   │   │   └── progress/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── public/
│   └── tests/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── resumes/
│   │   │   ├── profiles/
│   │   │   ├── roadmaps/
│   │   │   └── progress/
│   │   │
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── db/
│   │   ├── integrations/
│   │   │   ├── ai/
│   │   │   ├── rag/
│   │   │   └── storage/
│   │   └── main.py
│   │
│   └── tests/
│
├── ai/
│   ├── agent/
│   │   ├── orchestrator.py
│   │   ├── tools.py
│   │   └── state.py
│   │
│   ├── skill_gap/
│   │   ├── calculator.py
│   │   └── rules.py
│   │
│   ├── priority/
│   │   ├── scorer.py
│   │   └── rules.py
│   │
│   ├── roadmap/
│   │   ├── generator.py
│   │   ├── planner.py
│   │   └── validator.py
│   │
│   ├── replanning/
│   │   ├── detector.py
│   │   └── replanner.py
│   │
│   ├── prompts/
│   │   ├── roadmap.md
│   │   ├── replan.md
│   │   └── explanation.md
│   │
│   ├── providers/
│   └── tests/
│
├── rag/
│   ├── ingestion/
│   │   ├── collectors/
│   │   ├── loaders/
│   │   └── parsers/
│   │
│   ├── preprocessing/
│   │   ├── cleaner.py
│   │   └── chunker.py
│   │
│   ├── embeddings/
│   │   ├── embedder.py
│   │   └── models.py
│   │
│   ├── retrieval/
│   │   ├── retriever.py
│   │   ├── filters.py
│   │   └── reranker.py
│   │
│   ├── knowledge/
│   │   ├── skill_dependencies.py
│   │   ├── learning_modules.py
│   │   └── extractors.py
│   │
│   ├── context/
│   │   └── builder.py
│   │
│   └── tests/
│
├── data/
│   ├── ingestion/
│   │   ├── jsearch/
│   │   ├── extract_jobs.py
│   │   └── config/
│   │
│   ├── cleaning/
│   │   ├── job_cleaner.py
│   │   └── validators.py
│   │
│   ├── normalization/
│   │   ├── company_normalizer.py
│   │   ├── career_mapper.py
│   │   └── skill_normalizer.py
│   │
│   ├── skill_extraction/
│   │   ├── extractor.py
│   │   ├── confidence.py
│   │   ├── importance.py
│   │   └── schemas.py
│   │
│   ├── aggregation/
│   │   ├── career_skill_stats.py
│   │   └── market_baseline.py
│   │
│   ├── repositories/
│   ├── db/
│   └── tests/
│
├── shared/
│   ├── contracts/
│   │   ├── user/
│   │   │   └── user_context.schema.json
│   │   │
│   │   ├── market/
│   │   │   └── market_context.schema.json
│   │   │
│   │   ├── rag/
│   │   │   └── rag_context.schema.json
│   │   │
│   │   ├── agent/
│   │   │   ├── agent_input.schema.json
│   │   │   └── agent_output.schema.json
│   │   │
│   │   └── api/
│   │       └── api_response.schema.json
│   │
│   ├── mock/
│   │   ├── user_context.json
│   │   ├── market_context.json
│   │   ├── rag_context.json
│   │   ├── agent_input.json
│   │   └── agent_output.json
│   │
│   ├── enums/
│   └── types/
│
├── infra/
│   ├── aws/
│   │   ├── rds/
│   │   ├── s3/
│   │   ├── lambda/
│   │   ├── api-gateway/
│   │   └── iam/
│   │
│   ├── docker/
│   └── environments/
│
├── tests/
│   ├── integration/
│   │   ├── test_resume_flow.py
│   │   ├── test_rag_agent_flow.py
│   │   ├── test_roadmap_flow.py
│   │   └── test_replanning_flow.py
│   │
│   └── e2e/
│
├── migrations/
│
├── scripts/
│   ├── setup/
│   ├── seed/
│   ├── migrate/
│   └── deploy/
│
├── docs/
│   ├── architecture/
│   ├── db/
│   ├── schemas/
│   ├── api/
│   ├── ai/
│   ├── rag/
│   └── decisions/
│
├── .github/
│   └── workflows/
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

# 4. Frontend Folder

Primary owner:

```text
Frontend / Product Engineer
```

## `frontend/src/features/`

Organize the UI by product feature instead of putting everything in one components folder.

Example:

```text
features/resume/
```

Responsibilities:

```text
Upload CV
Extraction loading
Auto-fill result
Confirm / Edit
```

```text
features/roadmap/
```

Responsibilities:

```text
Roadmap overview
Roadmap step
Learning module
Best Next Action
```

```text
features/progress/
```

Responsibilities:

```text
Checklist
Progress bar
Complete step
Skip
Re-plan
```

---

# 5. Backend Folder

Primary owner:

```text
Backend Engineer
```

Structure:

```text
backend/app/

api/
models/
schemas/
services/
repositories/
integrations/
```

## `api/`

HTTP endpoints

Examples:

```text
POST /resumes
POST /resumes/{id}/extract

GET /profile
PATCH /profile

POST /roadmaps/generate
GET /roadmaps/{id}

PATCH /progress
```

## `models/`

ORM / Database Models

## `schemas/`

Request / Response Schema

## `services/`

Business Logic

Examples:

```text
ResumeService
ProfileService
RoadmapService
ProgressService
```

## `repositories/`

Database access

Examples:

```text
UserRepository
ResumeRepository
RoadmapRepository
```

## `integrations/`

Adapters for other systems:

```text
AI Service
RAG Service
S3
Market Service
```

---

# 6. AI Folder

Primary owner:

```text
AI / Agent Engineer
```

## `skill_gap/`

Inputs:

```text
Market Baseline
+
User Skill
```

Then calculate:

```text
Satisfied
Needs Improvement
Missing
```

## `priority/`

Determine which skill to prioritize.

Uses:

```text
Market Demand
Skill Gap
Skill Dependency
User Constraints
```

## `roadmap/`

Produces:

```text
Roadmap
Learning Sequence
Best Next Action
Reason
```

## `replanning/`

Detect triggers such as:

```text
Progress Completed
Goal Changed
Market Changed
Application Feedback
```

Then decide whether to:

```text
Continue roadmap
or
Generate new version
```

---

# 7. RAG Folder

Primary owner:

```text
Data & RAG Engineer
```

## `ingestion/`

Collect:

```text
Official Docs
Learning Paths
Technical Resources
```

## `preprocessing/`

```text
Clean
Parse
Chunk
```

## `embeddings/`

```text
Text
→ Vector
```

## `retrieval/`

Accept a query and retrieve relevant chunks.

```text
Query
→ Embedding
→ Vector Search
→ Top K Context
```

## `knowledge/`

Build structured knowledge.

For example:

```text
Skill Dependency
Learning Module
Concept Relation
```

## `context/`

Convert retrieval results into the agent contract.

```text
RAG
↓
rag_context.json
↓
Agent
```

---

# 8. Data Folder

Primary owner:

```text
Data & RAG Engineer
```

## `ingestion/`

JSearch API ingestion

## `cleaning/`

Validation / cleaning / deduplication

## `normalization/`

```text
Company normalization
Career mapping
Skill normalization
```

## `skill_extraction/`

Read job descriptions and extract:

```text
Skill
Requirement Type
Proficiency Level
Evidence
```

Then calculate:

```text
Importance
Confidence
```

## `aggregation/`

Produces:

```text
market.career_skill_stats
```

---

# 9. Shared Folder

This folder is central to parallel team development.

```text
shared/
```

All teams may read it; contract changes should receive a joint review.

## `shared/contracts/`

Store agreed schemas.

Examples:

```text
agent_input.schema.json
agent_output.schema.json
rag_context.schema.json
market_context.schema.json
```

The key principle is:

> Implementations may change, but contract changes require team agreement.

---

## `shared/mock/`

Mock data lets each team proceed before another component is ready.

Example:

```text
rag_context.json
```

This lets the AI engineer proceed while RAG is still in development.

```text
agent_output.json
```

This lets the frontend engineer build the roadmap UI while AI is still in development.

---

# 10. Infra Folder

Primary owner:

```text
Cloud / Integration Engineer
```

Stores configuration for:

```text
S3
RDS
Lambda
API Gateway
IAM
Docker
Environment
```

Keep infrastructure scripts separate from backend code and data pipelines.

---

# 11. Migrations

Store versioned schema changes for `core`, `market`, `knowledge`, and `app` in `migrations/`. Coordinate their order across teams. Keep migration runner scripts in `scripts/migrate/`; they are separate from the migration files. See [Database Architecture](db/glow_job_database_architecture.md) for the schema plan.

---

# 12. Tests

## Unit Tests

Keep unit tests near each feature:

```text
data/tests/
rag/tests/
ai/tests/
backend/tests/
frontend/tests/
```

## Integration Tests

Put integration tests in:

```text
tests/integration/
```

For example:

```text
CV → Profile

Market + User → Skill Gap

RAG → Agent

Agent → Roadmap

Progress → Re-plan
```

## E2E

Test:

```text
Upload Resume
→ Auto-fill
→ Select Career
→ Analyze
→ Roadmap
→ Complete Step
→ Re-plan
```

---

# 13. Docs Folder

Store architecture notes in `docs/db/` and database diagrams in `docs/schemas/`. The whole-system `glow-job.dbml` is canonical; pipeline and app DBML files are domain views of the same database.

```text
docs/
├── architecture/
├── db/
├── schemas/
├── api/
├── ai/
├── rag/
└── decisions/
```

Examples:

```text
docs/db/
└── glow_job_database_architecture.md

docs/schemas/
├── glow-job.dbml
├── pipeline-schema.dbml
└── app-schema.dbml
```

```text
docs/ai/
└── skill_extraction_spec.md
```

---

# 14. Branch Mapping

Use feature branches named for the work.

Examples:

## Data / RAG

```text
feature/job-ingestion
feature/company-normalization
feature/career-mapping
feature/skill-extraction
feature/market-aggregation

feature/rag-ingestion
feature/rag-embedding
feature/rag-retrieval
feature/skill-dependency
```

## AI

```text
feature/skill-gap
feature/priority-engine
feature/roadmap-agent
feature/replanning
```

## Backend

```text
feature/resume-upload
feature/resume-extraction
feature/user-profile-ingestion
feature/roadmap-api
feature/progress-api
```

## Frontend

```text
feature/ui-resume
feature/ui-profile
feature/ui-skill-gap
feature/ui-roadmap
feature/ui-progress
```

## Cloud / Integration

```text
feature/aws-rds
feature/aws-s3
feature/aws-lambda
feature/deployment
feature/integration-tests
```

---

# 15. Folder Ownership

| Folder | Main Owner |
|---|---|
| `frontend/` | Frontend |
| `backend/` | Backend |
| `ai/` | AI Engineer |
| `rag/` | Data & RAG |
| `data/` | Data & RAG |
| `infra/` | Cloud / Integration |
| `tests/integration/` | Cloud / QA and all teams |
| `shared/contracts/` | Shared / review together |
| `shared/mock/` | Shared |
| `docs/` | All teams |
| `migrations/` | Backend and Data / RAG, reviewed together |
| `scripts/migrate/` | Cloud / Integration (migration runners) |

---

# 16. Important Rule

Avoid having multiple contributors edit the same file unnecessarily.

Poor example:

```text
app.py
```

Containing:

```text
API
Database
AI
RAG
Data Pipeline
```

All these concerns are in one file.

Prefer separate modules:

```text
backend/app/services/roadmap_service.py
ai/roadmap/generator.py
rag/retrieval/retriever.py
data/skill_extraction/extractor.py
```

Each module has its own responsibility.

---

# 17. Integration Boundary

Teams should integrate through contracts rather than import one another's implementations directly.

Examples:

```text
RAG
↓
rag_context.json
↓
Agent
```

```text
Agent
↓
agent_output.json
↓
Backend
```

```text
Backend
↓
API Response
↓
Frontend
```

Each team can change its implementation while preserving the agreed contract.

---

# 18. Recommended MVP Flow

```text
Frontend
Upload Resume
      ↓
Backend
Resume API
      ↓
Resume Extraction
      ↓
User Profile
      ↓
Market Context
      +
RAG Context
      ↓
Agent
      ↓
Roadmap
      ↓
Backend
      ↓
Frontend
      ↓
Progress Update
      ↓
Re-plan
```

---

# 19. Summary

The project responsibilities are:

```text
frontend
= User-facing experience

backend
= APIs and application data

data
= Job market data

rag
= Knowledge Retrieval

ai
= Decision / Roadmap

shared
= Cross-team contracts

infra
= Deployment and runtime infrastructure

tests
= Integration and end-to-end verification
```

The key principle is:

> **Separate folders by responsibility and integrate through shared contracts.**

This supports parallel development, reduces merge conflicts, and lets teams work against mock contracts while other components are being built.


