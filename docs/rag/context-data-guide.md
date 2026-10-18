# RAG input previews and score experiments

Run these commands from the `glow-job` root using an environment with the
existing Backend requirements installed. No extra model provider is needed.
The preview and scoring comparison do not call Gemini or write to PostgreSQL.

## Read a Market snapshot

```powershell
python -m scripts.rag.preview_context --career-profile-id 1 --date-basis first_seen_at --output rag/data/inputs/market-inputs.json
```

Add `--profile-id prf_...` to include a saved, confirmed profile. Unresolved
skills remain separate; unknown proficiency is retained. The stdout summary
contains counts rather than evidence text. The output file contains evidence
excerpts when a profile is included; generated files under `rag/data/` are ignored by Git. The folder guide and `.gitkeep` files are tracked.

For development without a real CV, the optional [demo user seed](../db/demo-user-seed.md)
adds three saved profiles, including `prf_demo_student_data`. Read the mapped
career profile ID from its saved goal before selecting the preview cohort.
The seed writes user fixture data explicitly; the preview itself remains read-only.

The command reuses the shared database connector in `data-pipeline`. On
Windows it loads `data-pipeline/.env` without overriding existing environment
variables. Use `DB_HOST=localhost` and the published host port for a Windows
process. Inside the Compose network, environment variables supplied by the
root Compose stack take precedence and use `postgres` with its internal port.

The returned object has `status=input_preview`; it is not a completed Agent
Context. It contains source inputs and warnings, not a selected production
score policy or a generated Roadmap. The machine-readable input contract is
[context-inputs.schema.json](context-inputs.schema.json).

The Pydantic models also enforce cross-field rules (one cohort, unique skill
IDs, goal/career consistency, percentage units). JSON Schema alone cannot
express every cross-field invariant; keep those validations in an adapter
when integrating from another language.

## Use the existing Docker runtime

When a local virtual environment is unavailable, run the same command in a
temporary container using the existing Backend image:

```powershell
$taskWorkspace = (Get-Location).Path
New-Item -ItemType Directory -Force -Path rag/data | Out-Null
docker compose run --rm --no-deps -T -e PYTHONDONTWRITEBYTECODE=1 -v "${taskWorkspace}:/workspace:ro" -v "${taskWorkspace}/rag/data:/output" -w /workspace backend python -m scripts.rag.preview_context --career-profile-id 1 --date-basis first_seen_at --output /output/inputs/market-inputs.json
```

The database must already be running. The workspace is mounted read-only;
only the output directory is writable. This runs a command in a disposable
container rather than restarting the running API.

## Compare score denominators

```powershell
python -m scripts.rag.compare_match_policies --input rag/data/inputs/market-inputs.json --output rag/data/scoring/score-comparison.md --json-output rag/data/scoring/score-comparison.json
```

Alternatively pass `--career-profile-id 1 --date-basis first_seen_at` instead
of `--input` to read a fresh snapshot. `--top-count` defaults to 10 and
`--cumulative-share` to 0.80; these are experimental parameters, not approved
product settings. All tied weights at a cutoff are retained.

To include an uploaded, confirmed Resume, pass `--profile-id prf_...` together
with `--career-profile-id`. An exported `--input` containing `user` also works;
do not combine `--input` and `--profile-id`. The report includes a separate
`saved_profile` result, using actual confirmed canonical IDs and counting
unresolved/out-of-cohort skills separately. See the [Thai real-Resume guide](test-real-resume-scores.md)
for upload steps, Docker commands and interpretation.

The six synthetic user scenarios remain separate and are constructed from the selected Market
snapshot. They do not represent real CVs. Reports compare skill-presence
coverage, not proficiency alignment or job readiness. Availability and Roadmap
Top-N never affect the denominator. See the [first comparison](market-score-comparison.md)
before selecting a scoring policy.

The baseline recomputes the old coverage formula within the same explicit
snapshot/date basis as the experiments. It does not promise numerical parity
with the existing HTTP endpoint's market query. The scoring API and UI remain
unchanged. Score reports omit profile identity and CV evidence.

## Backend integration boundary

`rag.context.repository.load_inputs(connection, career_profile_id=..., profile_id=..., date_basis=...)`
accepts an idle PostgreSQL connection and owns one read-only transaction. The
Backend must authorize the selected profile before calling this internal
function. A CLI database owner can inspect local data; this is not an HTTP
authentication endpoint.

A missing saved goal remains null with a warning. The repository does not
invent preferences, a deadline, or Other details before the Backend supplies
them. Goal/profile IDs are checked for consistency. Catalog skills and aliases
are not created by this code.

## Verification

Portable contract and scoring checks use standard `unittest` plus the existing
Pydantic dependency:

```powershell
python -m unittest discover -s tests/rag -p 'test_*.py' -v
```

PostgreSQL checks are opt-in via `RAG_POSTGRES_CHECKS=1`. The repository checks
read saved data only. The dependency migration checks create a table inside a
transaction and roll it back after each case; they never record a migration
as applied. They skip if a dependency table already exists, so they cannot use
or change real dependency records. Run them before migration 014 is applied,
or on an isolated test database.

```powershell
$taskWorkspace = (Get-Location).Path
docker compose run --rm --no-deps -T -e PYTHONDONTWRITEBYTECODE=1 -e RAG_POSTGRES_CHECKS=1 -v "${taskWorkspace}:/workspace:ro" -w /workspace backend python -m unittest discover -s tests/rag -p 'test_*.py' -v
```

Preparing or testing `014_create_skill_dependencies.sql` does not apply it.
Use the repository migration runner when the migration is reviewed and ready.
Learning modules remain deferred. The document dependency review/apply flow is now
implemented; 18 human-approved relationships are applied with live evidence/scope
checks. See the [prepared-document dependency guide](../../data-pipeline/docs/documents/skill-dependency-review-guide.md).

The next assembly layer is available in the [Agent Context guide](agent-context-guide.md):
it combines these saved inputs with cited knowledge locally, groups foundations,
deduplicates evidence and preserves unknown gap/score states. Its output remains
`preview_pending_policies`, with production policy decisions still open.
