# Resume/CV Documentation

This folder keeps the cross-layer references for CV extraction, confirmed
profile storage, and resume-to-market skill matching. The frontend and backend
implement the local learner flow; the API and profile schema documentation
describe their shared contracts. The current extraction code review and domain
specification are in
[`data-pipeline/docs/resume/`](../../data-pipeline/docs/resume/).

## Documents

| Document | Purpose |
|---|---|
| [01-architecture.md](01-architecture.md) | Demo frontend, backend, data-pipeline, and database responsibilities and flow. |
| [02-profile-schema.md](02-profile-schema.md) | `CvProfile` contract used by extraction, API, and profile review. |
| [03-api-reference.md](03-api-reference.md) | Implemented CV, profile, and Career Match API endpoints. |
| [04-extraction-flow.md](04-extraction-flow.md) | Parsing, extraction, validation, normalization, and privacy details. |
| [05-database-mapping.md](05-database-mapping.md) | Mapping from confirmed profile fields to PostgreSQL `app.*` tables. |
| [06-profile-data-requirements.md](06-profile-data-requirements.md) | CV fields needed by profile, skill-gap, and roadmap consumers. |
| [07-market-matching.md](07-market-matching.md) | Resume-to-market matching formula, implementation status, and limitations. |

Use the database design in [`docs/schemas/glow-job.dbml`](../schemas/glow-job.dbml)
as the schema reference. The files in this folder describe how the current CV
flow maps to that design; they do not define a separate database schema.
