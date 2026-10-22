# Applications API contract

The personal application tracker is scoped to a saved anonymous profile. Every request uses
`X-Session-Id`, and the backend must verify that the profile belongs to that session before
reading or changing any application.

## Personal tracker

- `GET /api/profiles/{profile_id}/applications` returns the caller's application entries, newest
  update first. Search, status filtering and date filtering remain client-side for the initial UI
  integration.
- `POST /api/profiles/{profile_id}/applications` creates a manual tracker entry.
- `GET /api/profiles/{profile_id}/applications/{application_id}` returns one owned entry and its
  recorded status history.
- `PATCH /api/profiles/{profile_id}/applications/{application_id}` updates the editable fields. A
  status transition and its history event must be committed in one database transaction.

The response uses the existing frontend `ApplicationEntry` fields: `id`, `company`, `role`,
`status`, `relevantDate`, `relevantDateISO`, `nextStep`, `jobUrl`, `applicationDate`,
`jobDescription`, `location`, `statusHistory`, `rejectionCategory` and `rejectionReason`.
`statusHistory` is built only from recorded events. Existing rows have no fabricated historical
events; their current status remains visible.

## Status mapping

The UI vocabulary stays stable. The repository maps `wishlist` to `interested`, `interview` to
`interviewing`, and `offer` to `offered`; `screening` is added to the database enum. `applied` and
`rejected` map directly. The database-only `withdrawn` state is not exposed by this page yet.

The existing `app.job_applications.notes` column stores the user's `nextStep` text. A later step
can attach a market posting through the existing nullable `job_id`; manually entered tracker rows
remain valid with no `job_id`.

## Persistence

Migration `019_application_tracker_persistence.sql` extends the existing application table with
fields needed by the current form, including a company-name snapshot for manually entered roles,
and adds `app.application_status_events`. It preserves existing rows and does not invent events
for their prior history.
