# Resume and CV Extraction Documentation

> **Documentation status (2026-10-11):** This folder contains reference material
> from the original backend prototype, updated cross-layer notes, and a few
> historical deployment/model experiments. It is retained for traceability;
> it is not all a statement of the current implementation.

## Current source of truth

For the current resume extraction code boundary, current-state review, and
proposed implementation scope, start with the
[`data-pipeline` resume documentation](../../data-pipeline/docs/resume/README.md).
The backend owns HTTP routes, upload handling, job lifecycle, and profile
persistence. The reusable resume extraction domain lives in
`data-pipeline/src/resume/`.

## Documents in this folder

| Document | Status and purpose |
|---|---|
| [02-architecture.md](02-architecture.md) | Cross-layer architecture notes. Some model and deployment details describe the earlier local prototype. |
| [03-data-schema.md](03-data-schema.md) | Resume profile contract reference used by the API and frontend work. |
| [04-api-spec.md](04-api-spec.md) | API endpoint and error-envelope reference, linked by the current backend router. |
| [05-extraction-pipeline.md](05-extraction-pipeline.md) | Current Gemini-based extraction flow and provider contract. |
| [06-aws-setup-and-cost.md](06-aws-setup-and-cost.md) | **Historical planning only.** AWS services, prices, and deployment options were not verified as the current deployment plan. |
| [07-local-qwen-setup.md](07-local-qwen-setup.md) | **Historical experiment record.** Ollama/Qwen notebook setup and model results are not the current model selection instructions. |
| [08-database-mapping.md](08-database-mapping.md) | Cross-layer mapping between extracted profiles and the app database design; confirm against the current DBML before implementation. |
| [09-fields-needed-from-cv.md](09-fields-needed-from-cv.md) | Database/extraction gap analysis, updated for the current app schema design. |

The historical files are intentionally kept as project evidence and context.
Do not use the AWS cost estimates or local Qwen setup steps as operational
instructions without re-validating them.
