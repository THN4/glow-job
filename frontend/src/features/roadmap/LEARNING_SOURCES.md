# Retrieved learning materials

`RoadmapPage` accepts a `loadSources` function. Configure it using
`createLearningSourcesLoader(endpoint)` when a backend endpoint is implemented.
Set each roadmap skill node's `skillId` to its canonical `core.skills` ID.
UI slugs such as `airflow` are not database IDs.

The loader posts `{ "skill_ids": [id], "intent": "fundamentals" }` and accepts
the document pipeline's `knowledge-context-preview-1` response. The existing
pipeline preview is not currently exposed through a backend HTTP route.
No request is made until both a loader and canonical skill ID are supplied.

Sources show reviewed citations from `supported` or `partial` results. Quotes
must occur in their referenced retrieved chunk. Uncited chunks are omitted.
Partial results are labelled; unreviewed, insufficient, failed and empty results
have separate UI states. Failed requests can be retried. HTTP(S) links are
allowed; missing or invalid links leave the source title as plain text.

Requests are keyed by canonical skill ID, cached for five minutes and receive
an AbortSignal. Changing skills never shows the previous skill's materials.
Until retrieval is configured, curated documentation is explicitly labelled.
Empty or failed retrieval does not silently substitute curated results.
Checklists remain separate user progress; retrieval never marks tasks completed.
