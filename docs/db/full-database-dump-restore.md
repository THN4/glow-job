# Sharing a full Glow-Job database dump

This guide packages the complete `glowjob` PostgreSQL database for a teammate.
The archive includes the database schema and all data, including the `market`,
`core`, `knowledge`, `app`, and `system` schemas. It does not include PostgreSQL
roles or other databases on the same server. The teammate does not need to run
JSearch, crawl source websites, extract documents, chunk text, or generate
embeddings.

Because this is a full database dump, it may also include user, resume/profile,
market, and other application data. Confirm that the complete database is
appropriate to share with the teammate before sending the archive.

## Prerequisites

- Docker Desktop is installed and running.
- The repository and its `data-pipeline` submodule are available locally.
- Use the database name, user, and password from `data-pipeline/.env` when
  starting PostgreSQL. Adjust the restore command if you use different values.
- The commands below use the defaults `glowjob` for the database and user.
  Replace them if your `.env` uses different values.

The PostgreSQL image includes pgvector; a separate vector database is not
needed. Run Compose commands from the same directory/configuration that started
that PostgreSQL service. In the current Glow-Job workspace, PostgreSQL is
running from the root `compose.yaml`, so the sender's dump commands below run
from the repository root. The teammate can start a fresh PostgreSQL service
from `data-pipeline` as described below.

## Create a fresh full dump on the sender's computer

First make sure the root Compose PostgreSQL service is running and contains the
current data:

```text
docker compose up -d postgres
```

Run this command from the repository root. If PostgreSQL was started from a
different Compose file, use that same Compose context for both `up` and the dump
commands below.

The following commands create a compressed dump of the entire `glowjob` database
(schema and data) inside the Postgres container, then copy it to the repository
root. Do not commit the dump file to Git; share it with the
teammate as a separate file.

### Command Prompt (CMD)

```bat
cd /d C:\path\to\glow-job
docker compose exec postgres pg_dump -U glowjob -d glowjob -Fc -f /tmp/glowjob-full.dump
docker compose cp postgres:/tmp/glowjob-full.dump .\glowjob-full.dump
```

### PowerShell

```powershell
Set-Location "C:\path\to\glow-job"
docker compose exec postgres pg_dump -U glowjob -d glowjob -Fc `
  -f /tmp/glowjob-full.dump
docker compose cp postgres:/tmp/glowjob-full.dump .\glowjob-full.dump
```

Replace `C:\path\to\glow-job` with the repository's actual path. The archive
format (`-Fc`) keeps the output compressed and includes schema definitions,
table data, indexes, constraints, extensions, and the migration history table.
Restore it with `pg_restore` into a fresh, empty database.

## Set up a teammate's database and restore the dump

### 1. Prepare local settings

From the repository root, initialize the submodule if necessary:

```text
git submodule update --init --recursive
```

In `data-pipeline`, copy `.env.example` to `.env` and edit it. For CMD:

```bat
cd /d C:\path\to\glow-job\data-pipeline
copy .env.example .env
```

For PowerShell:

```powershell
Set-Location "C:\path\to\glow-job\data-pipeline"
Copy-Item .env.example .env
```

Keep `DB_HOST=localhost` for commands run from Windows, and set `DB_NAME`,
`DB_USER`, `DB_PASSWORD`, and `DB_PORT` as needed. Keep `.env` private and out
of Git.

### 2. Start PostgreSQL

Run in `data-pipeline` from either CMD or PowerShell:

```text
docker compose up -d postgres
```

This starts only PostgreSQL. Docker downloads the configured pgvector image if
it is not already present. The backend container is not required just to load
the database.

### 3. Copy and restore the archive

Do not run migrations before restoring a full dump: the archive already
contains the schemas, tables, and `system.schema_migrations` history. Place
`glowjob-full.dump` in the teammate's `data-pipeline` directory. Run the
following commands from there in either CMD or PowerShell:

```text
docker compose cp .\glowjob-full.dump postgres:/tmp/glowjob-full.dump
docker compose exec postgres pg_restore -U glowjob -d glowjob --clean --if-exists --exit-on-error --no-owner --no-privileges /tmp/glowjob-full.dump
```

The default Compose setup creates an empty `glowjob` database when its data
volume is first initialized. Restore only into a database that is safe to
replace: `--clean` drops the objects represented in the archive before
recreating them. If the target database has unrelated data or should be
preserved, create a separate fresh database and restore there instead. If the
database name or user differs from the defaults, update `-d glowjob` and
`-U glowjob` to match the target. The teammate does not need to install Python
or run the migration runner just to restore and use this database.

## What the teammate runs and does not run

The teammate starts PostgreSQL and restores the full dump. They do not run the
market/JSearch pipeline, document crawler/extraction, chunking, or embedding
scripts. The restored `system.schema_migrations` history allows the migration
runner to skip already-applied versions if it is needed later. To use the data
through the application, they can start the backend and other required
services separately.
