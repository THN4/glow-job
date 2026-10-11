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
roadmaps. It is not applied to any database until the command is run.

Add a new migration with the next unused, zero-padded version number across
both directories. Do not edit or renumber an already-applied migration. The
knowledge schema remains a future migration; `app.roadmap_steps.module_id`
will receive its foreign key when `knowledge.learning_modules` is implemented.
