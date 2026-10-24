# AWS Data Pipeline Setup Specification

> **Status:** Draft for discussion
> **Scope:** AWS foundation for the Glow-Job data pipeline: RDS PostgreSQL, S3 raw data storage, and scheduled job-data collection with EventBridge and Lambda.
> **This document describes a target setup.** It does not mean the AWS resources or integrations have already been created.

## 1. Purpose

Define the work needed to move the data-pipeline storage and scheduled job-data collection from local development toward AWS. The MVP will:

- Store relational application, market, and knowledge data in one Amazon RDS for PostgreSQL database.
- Store source files and immutable raw job-provider responses in a private Amazon S3 bucket.
- Fetch job-market data on a schedule using Amazon EventBridge and AWS Lambda.
- Store extracted and structured CV information as relational data in RDS. Store an original CV PDF in S3 only when the product requires retaining it.
- Preserve the existing local Docker Compose workflow for development.

The current database plan uses one PostgreSQL database with `core`, `market`, `knowledge`, `app`, and `system` schemas. See [Glow-Job Database Architecture](db/glow_job_database_architecture.md).

## 2. Scope

### In scope

- AWS account and Region selection for this environment.
- IAM roles and least-privilege policies for the pipeline components.
- One private S3 bucket for raw provider data and retained source files.
- One RDS for PostgreSQL instance with the required schemas and `pgvector` extension, if used by the selected migrations.
- Network access from the database-writing workload to RDS.
- EventBridge schedule and Lambda deployment for job-market collection.
- Secrets storage, logs, basic failure visibility, and deployment verification.
- A migration path from the existing PostgreSQL schema/data and local pipeline output.

### Out of scope for this setup

- Replacing the frontend or general application backend hosting.
- Roadmap-agent model selection and Bedrock setup.
- Building a new CV extraction product flow. This spec only defines where CV source files and structured CV data belong.
- Step Functions, queues, OpenSearch, a separate vector database, multiple RDS instances, or production high-availability design.
- Replacing the existing local development database.

## 3. Target data flows

### 3.1 Job Description collection

```text
EventBridge schedule
        ↓
Fetch Lambda
        ↓
External job provider (initially JSearch)
        ↓
Raw provider response → S3
        ↓
Validate / clean / deduplicate / normalize / enrich
        ↓
RDS PostgreSQL (market and related schemas)
        ↓
Refresh market statistics when required
```

For the first integration, invoke the Lambda manually or on demand and verify the complete run before enabling a recurring schedule. The raw response must be written to S3 before downstream transformations so a run can be replayed without fetching the provider again.

The existing market pipeline already describes extraction, replay, normalization, skill extraction, relational loading, and aggregation. AWS integration should adapt its storage and execution entry points rather than create a second implementation. See [Market Data Pipeline Flow](../data-pipeline/docs/market/market-pipeline-flow.md) and [Market Pipeline Specification](../data-pipeline/docs/market/market-pipeline-spec.md).

### 3.2 CV data

```text
CV source PDF (if retained) → private S3 object
                                      │
                         text extraction / OCR / CV parsing
                                      ↓
                    structured CV fields → RDS app schema
```

CV details such as profile fields, experience, and skills belong in relational tables in RDS. RDS may store a JSONB profile snapshot where defined by the application schema, but should not store PDF bytes. If the original PDF is retained, RDS stores its object key and related metadata. CV upload and extraction are not periodic EventBridge fetch jobs; their trigger belongs to the upload/processing flow and is not implemented by the JD schedule in this scope.

The existing database documentation says the current resume flow stores a confirmed profile but does not yet create `app.resumes` or `app.resume_extractions` rows. Confirm whether those records are required and add reviewed migrations before relying on them.

## 4. AWS components and responsibilities

| Component | Responsibility | MVP configuration |
|---|---|---|
| Amazon RDS for PostgreSQL | Relational system of record | One instance/database; use the agreed schemas; enable `vector` only if required by migrations; private network access |
| Amazon S3 | Raw and unstructured source data | Private bucket, encryption enabled, public access blocked, separate prefixes by data type and run |
| Amazon EventBridge | Schedule recurring JD collection | Enable only after manual/on-demand Lambda run succeeds |
| AWS Lambda | Execute bounded collection or processing steps | Deploy existing pipeline code or a thin entry point that calls it; configure timeout, memory, environment, role, and logs |
| AWS IAM | Service permissions | Separate execution role; allow only required S3 paths, secret reads, logs, and database network access |
| AWS Secrets Manager | External API and database secrets | Do not put API keys or passwords in source control or Lambda code |
| Amazon CloudWatch | Logs and failure visibility | Structured run logs, error/timeout monitoring, and a basic alarm or notification path |
| VPC / Security Groups | Protect RDS connectivity | RDS is not publicly accessible; allow inbound PostgreSQL only from the approved database-writing workload |

## 5. Storage layout and data ownership

Suggested S3 key layout (bucket name is environment-specific):

```text
market/raw/<provider>/YYYY/MM/DD/<run_id>/<query_id>.json
resumes/raw/<opaque_user_id>/<resume_id>/<original_filename>
resumes/processed/<opaque_user_id>/<resume_id>/<version>.json
```

Rules:

- Keep provider response files immutable. A rerun should write a new run ID rather than overwrite a previous source snapshot.
- Do not place names, email addresses, or other direct identifiers in S3 keys. Use opaque IDs.
- Store raw JD JSON and original CV PDFs in S3; store normalized JD records and structured CV facts in RDS.
- Store processed CV JSON in S3 only if it is needed for replay/audit. The canonical application data remains in RDS.
- Define retention and deletion for CV PDFs and derived CV artifacts before accepting real user documents.
- Use S3 lifecycle rules only after the team agrees on retention requirements.

RDS destinations should follow the existing schema ownership plan:

- JD and market outputs: `core` and `market` (plus `knowledge` for pipeline-owned knowledge data where applicable).
- Structured CV/profile data: `app`.
- Shared run or operational records: `system` if the schema and migration are approved; CloudWatch is sufficient for initial run logs.

## 6. Network and execution design

RDS should use private subnets and have public accessibility disabled. The Lambda function that writes directly to RDS must be configured for VPC access, with its security group allowed by the RDS security group on the PostgreSQL port.

The JD provider is a public internet API. A VPC-attached Lambda that both reaches private RDS and calls a public provider needs an outbound internet design, commonly a NAT Gateway, which can add ongoing cost. Before implementation, choose one of these approaches:

1. **Single Lambda with VPC egress:** simpler function flow; budget for and configure outbound internet access.
2. **Split fetch and load:** a non-VPC fetch Lambda calls the provider and writes raw data to S3; a separate private/VPC processing function loads RDS. This avoids giving the fetch stage database access, but adds a component and trigger/coordination work.

For an initial competition MVP, prefer the simplest option that meets the available budget and security requirements. Record the chosen option before creating network resources. Do not make RDS public as a shortcut.

## 7. Processing requirements

- **Idempotency:** rerunning the same input must not create duplicate job postings or duplicate relationships. Use the provider's stable job identifier and existing database uniqueness/upsert rules where available.
- **Replayability:** a pipeline run can be replayed from S3 raw data without calling the external provider again.
- **Run identification:** logs and S3 keys include a stable `run_id`, provider, and collection date.
- **Partial failure:** report counts for fetched, stored, rejected, deduplicated, loaded, and failed records. A failure must be visible and must not silently mark the whole run successful.
- **Bounded Lambda work:** confirm expected request count and end-to-end duration against Lambda timeout/runtime limits. Split long processing stages or use a longer-running compute option if the existing pipeline does not fit.
- **Provider throttling:** use bounded retries/backoff and avoid overlapping scheduled runs unless the pipeline is safe to run concurrently.
- **Secrets:** retrieve provider API credentials from Secrets Manager through the Lambda execution role.

## 8. Setup and delivery phases

### Phase 0 — Confirm design inputs

- Select AWS account/environment and Region.
- Confirm provider, query plan, refresh frequency, and expected records per run.
- Confirm CV retention policy and whether original PDFs are stored in S3.
- Confirm the VPC egress option and available AWS credit/budget.
- Confirm the RDS schema/migrations and current local database source.

### Phase 1 — Provision the storage foundation

- Create the IAM roles/policies, VPC/subnets/security groups, private S3 bucket, and RDS PostgreSQL instance.
- Configure encryption, backups, access boundaries, and secret storage.
- Create the database and apply the approved schema migrations, including `vector` if required.
- Record endpoint/secret references in the deployment configuration; do not commit secret values.

### Phase 2 — Integrate and run on demand

- Adapt the market pipeline raw-data writer to S3 and its database configuration to RDS.
- Deploy the Lambda entry point and grant it only the required permissions.
- Invoke one controlled collection run manually/on demand.
- Verify raw S3 objects, expected relational rows, replay behavior, and failure logs.

### Phase 3 — Enable scheduled collection

- Create the EventBridge schedule and target the deployed Lambda.
- Set retry/dead-letter handling appropriate to the selected invocation pattern.
- Add basic error/timeout monitoring and document how to disable the schedule.
- Observe at least one scheduled run before treating the collection as operational.

### Phase 4 — CV storage integration, if included in this delivery

- Confirm the relational CV schema and migrations.
- If retaining PDFs, configure upload to a private S3 prefix and store only the object reference in RDS.
- Confirm deletion removes the database references and retained S3 objects/derived artifacts according to the agreed retention policy.

## 9. Acceptance criteria

- RDS is reachable by the authorized workload and not publicly accessible.
- Required schemas and migrations are applied, and `pgvector` is available if required by the application.
- A controlled JD run writes the source response to S3 before loading its transformed data into RDS.
- Replaying the same run does not create duplicate market records.
- An unsuccessful provider, S3, or database operation appears as a failed run in logs and is not reported as successful.
- EventBridge can invoke the Lambda on the agreed schedule, and the schedule can be disabled without deleting data.
- No provider/database secrets are committed to the repository or embedded in the function artifact.
- CV structured data is stored in RDS; any retained original PDF is private in S3 and referenced from RDS rather than stored as a database binary.
- Local Docker Compose development remains usable and is not silently redirected to AWS.

## 10. Open decisions

1. Which AWS Region and account/environment should host the MVP?
2. What JD collection cadence and query volume are required?
3. Does the existing full pipeline, including skill extraction and aggregation, fit in Lambda, or should Lambda only fetch/store raw responses initially?
4. Which network design will allow the fetch workload to reach both the public provider and private RDS within budget?
5. How long should raw JD data, original CV PDFs, and processed CV artifacts be retained?
6. Which CV fields and records must be persisted relationally, and do migrations for resume/extraction records need to be added?
7. What is the approved RDS instance size, backup retention, and development shutdown strategy?

## 11. Related project references

- [Glow-Job Database Architecture](db/glow_job_database_architecture.md)
- [Market Pipeline Specification](../data-pipeline/docs/market/market-pipeline-spec.md)
- [Market Data Pipeline Flow](../data-pipeline/docs/market/market-pipeline-flow.md)
- [Repository README and local development setup](../README.md)
