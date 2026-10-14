# glow-job
NTT DATA Digital Innovation Challenge 2026

## `data-pipeline` submodule

`data-pipeline/` is a Git submodule that points to a specific commit in the
[`glow-job-data-pipeline`](https://github.com/THN4/glow-job-data-pipeline)
repository. The commit recorded by `glow-job` is the version the team should
use; the submodule does not automatically follow the latest changes upstream.

### Clone or initialize the submodule

When cloning `glow-job`, initialize its submodules:

```bash
git clone --recurse-submodules <glow-job-repository-url>
```

If you already cloned `glow-job` and `data-pipeline/` is empty or not initialized,
run this from the `glow-job` repository root:

```bash
git submodule update --init --recursive data-pipeline
```

This checks out the exact `data-pipeline` commit selected by the current
`glow-job` commit. It does not update to the latest upstream commit.

If your checkout has an older `data-engineer/` folder instead, run the command
from the repository root as shown above. Git will create `data-pipeline/` next
to `data-engineer/`; it will not rename or delete the older folder. Keep any
work in `data-engineer/` until you have confirmed it is no longer needed.

If a `data-pipeline/` folder already exists and Git cannot initialize the
submodule because the path is not empty, do not delete or overwrite it. Check
for local work first and ask the project maintainer how to handle that checkout.

### Run PostgreSQL and the backend with Docker Compose

Docker Compose is owned by this root repository so the app and shared database
can be started together. The backend image is built from
`backend/Dockerfile`; its reusable extraction code is copied from the pinned
`data-pipeline/src/` submodule. The database volume is external and defaults to
the volume name used by the existing `data-pipeline/compose.yaml`, so Compose
fails instead of silently creating an empty database when that volume is not
present. Use this root Compose stack for integrated backend work; do not start
the standalone `data-pipeline` PostgreSQL service at the same time: both publish
the same host port, and two PostgreSQL containers must not use the same data
volume concurrently.

1. Initialize the submodule as described above.
2. Copy `.env.example` to `.env` and set `DB_PASSWORD` (and `GEMINI_API_KEY` if
   using Gemini).
3. Confirm the name of the Docker volume that already holds the
   `data-pipeline` database:

   ```bash
   docker volume ls
   ```

   Set `POSTGRES_VOLUME_NAME` in `.env` to that exact existing volume name if it
   differs from the default. If you cannot find the volume, stop and verify the
   database location before starting Compose; do not create a replacement
   volume unless you intentionally want a fresh, empty database.
4. Start the services from the repository root:

   ```bash
   docker compose up --build -d
   ```

The backend is available at `http://localhost:8787`; PostgreSQL is exposed on
`localhost:${DB_PORT}`. `DB_PORT` is the port on Windows, while
`DB_CONTAINER_PORT` is PostgreSQL's port inside Docker (normally `5432`). The
Backend connects to `postgres:${DB_CONTAINER_PORT}` from inside Compose. If
this is a fresh database, run the migration command from
`data-pipeline/` with matching `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values
and `DB_HOST=localhost`. Re-run the migration command after code changes that
add a new numbered migration; it skips versions already applied and does not
reset the database.

To connect pgAdmin running as a Windows desktop app to this same database,
register a server with Host `localhost`, Port `${DB_PORT}` (for example `5435`),
Maintenance database `${DB_NAME}`, and the `DB_USER`/`DB_PASSWORD` from the root
`.env`. Do not create a second database in pgAdmin. If pgAdmin itself runs in a
container on the same Compose network, use Host `postgres` and Port `5432`
instead; `localhost` inside that container would refer to pgAdmin itself.

Stop services with `docker compose down`. This keeps the database volume. Do
not use `docker compose down -v` unless you intend to delete local database and
backend data.

### Development rules

- Continue regular feature development in the `glow-job` repository.
- Do not edit files, create commits, switch branches, or run `git pull` from
  inside `data-pipeline/` as part of `glow-job` work.
- Do not run `git submodule update --remote` or manually change the submodule
  commit. That moves the version pinned by `glow-job` and can make everyone's
  checkout inconsistent.
- If work requires a change to `data-pipeline`, make that change through its
  own repository workflow and ask the project maintainer to update the pinned
  submodule commit in `glow-job`.
- Pulling the `glow-job` repository itself follows the normal team workflow;
  after switching or pulling its branch, run the initialization command above
  if Git reports that the submodule is not initialized.
