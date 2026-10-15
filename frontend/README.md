# Glow Job Frontend

## CV extraction and profile save

The anonymous CV flow is available at `http://localhost:5173/onboarding/cv`.
It uploads a PDF or image to the Backend API, polls Gemini extraction, lets the
user review and edit the extracted profile, then saves the confirmed profile
through `PUT /api/profiles`. The anonymous `sessionId` and saved `profileId`
are retained in browser local storage so the profile can be loaded again in
that browser.
During extraction, **Cancel waiting and choose another CV** stops this page's
polling and returns to the upload step. The backend job may finish in the
background, but no profile is written until confirmation.

Start PostgreSQL and Backend from the repository root with `docker compose up -d`.
The Backend must have `RESUME_EXTRACTOR=gemini` and a valid `GEMINI_API_KEY` in
the root `.env` file. Start the frontend from this folder with:

```sh
npm run dev
```

By default, the frontend calls `http://localhost:8787/api`. To use a different
API, create `frontend/.env.local` with:

```dotenv
VITE_API_BASE_URL=http://localhost:8787/api
```

Supported uploads are PDF, JPEG, PNG, and WEBP, up to 10 MB. The CV file and
in-progress extraction are temporary; only the profile saved after user
confirmation is persisted to the database. See
[`docs/cv-extraction/03-api-reference.md`](../docs/cv-extraction/03-api-reference.md)
for the API contract and
[`docs/cv-extraction/05-database-mapping.md`](../docs/cv-extraction/05-database-mapping.md)
for database mapping.
