# Glow Job frontend

The React, TypeScript, and Vite app provides the learner-facing flows for:

- uploading a CV, reviewing the extracted profile, and confirming profile data;
- comparing the profile with a selected career's market skill requirements;
- saving a career goal and preferences, generating a roadmap, and tracking tasks;
- viewing roadmap relationships, learning evidence, history, and job applications.

The frontend talks to the FastAPI backend. CV extraction uses the provider
configured by the backend; the current local setup uses Bedrock Converse with
Nova 2 Lite. The browser does not call model APIs directly.

## Run locally

Start PostgreSQL and the backend from the repository root first:

```bash
docker compose up --build -d
```

Then, from `frontend/`:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. If that
port is occupied, Vite selects the next available port. The default backend
URL is `http://localhost:8787/api`.

To use another backend URL, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8787/api
```

Supported CV uploads are PDF, JPEG, PNG, and WEBP up to 10 MB. Uploads are
temporary; extracted profile information is saved only after the learner
reviews and confirms it.

## Build

```bash
npm run build
```

See the root [project README](../README.md) for system architecture and setup,
the [CV API reference](../docs/cv-extraction/03-api-reference.md) for upload
contracts, and the [Roadmap API contract](../docs/roadmap/api-contract.md) for
goal, generation, progress, and history endpoints.
