# Host repository migrations

Host-owned SQL migrations live in `migrations/versions/`. They share the
`system.schema_migrations` history with the pipeline-owned files in
`data-pipeline/migrations/versions/`.

Run the combined ordered history from the data-pipeline sub-repository:

```powershell
cd data-pipeline
python -m scripts.database.migrate
```

The runner applies both directories in filename order and skips versions
already recorded in `system.schema_migrations`. Migration `008` creates the
application schema used by onboarding, resume review, career goals, and
roadmaps. Migration `009` adds anonymous Resume profile persistence. These
migrations are not applied to any database until the command is run. Migration
`016` adds profile snapshots so a previous saved profile can be restored after
an accidental update.

Add a new migration with the next unused, zero-padded version number across
both directories. Do not edit or renumber an already-applied migration.
Pipeline migration `010` enables pgvector, `011` creates the MVP knowledge
source and chunk tables, `012` normalizes the Apache Airflow skill label, and
`013` adds many-to-many chunk-to-skill links for chunks covering multiple skills.
Pipeline migration `014` defines evidence-backed skill dependencies; it requires
an explicit migration run before the table exists in a database. Dependency
scope, chunk provenance and review metadata are added by pipeline
migration `015`; scoped verified relationships are context only. Both files must
be applied before writing through the current dependency workflow. Learning
modules remain deferred; `app.roadmap_steps.module_id` will receive its foreign
key when `knowledge.learning_modules` is implemented.

Host migration `016` adds roadmap generation: step/task plan fields, the
`app.roadmap_generations` snapshot table and token/cost columns on
`system.ai_runs` (see [roadmap generation](../docs/roadmap/roadmap-generation.md)).

Host migration `017` adds skill assessments: the question bank, self-check
statements, assessments and answers, two new `proficiency_basis` values
(`self_reported`, `assessed`) and step-check flags on `app.user_task_progress`
(see [assessments](../docs/assessments/assessment-plan.md)). Load the reviewed seed
questions afterwards with `scripts.assessments.load_bank`.

Host migration `018` adds on-demand step-check questions: the `provisional` item status and
`app.assessment_generations` (daily cap and retry back-off, see
[question bank](../docs/assessments/question-bank.md)).

## Development user data

After the schema is ready, optionally run
[`scripts/database/seeds/seed_demo_users.sql`](../scripts/database/seeds/seed_demo_users.sql).
This is an explicit development seed, not a numbered migration. It adds three
synthetic anonymous profiles and their related user data, preserving existing
accounts and demo edits on reruns. It reads existing catalog IDs and does not
create Market or Knowledge data. See the [seed guide](../docs/db/demo-user-seed.md)
for pgAdmin/PowerShell commands and fixture details.
