# RAG data and Context preparation

This host-owned package prepares application-facing data for the AI/Backend
team. It does not run a Roadmap Agent or expose HTTP routes. Document ingestion,
embeddings, shared catalog normalization, and pipeline-owned migrations remain
in `data-pipeline`.

Local generated artifacts are organized under [`data/`](data/README.md): input
snapshots, scoring reports, cited knowledge, assembled Agent Context, and archived
runs. Only the folder scaffold and guide are committed; generated data stays local.

Current functionality:

- Validate canonical confirmed skills, unresolved names, proficiency evidence,
  saved goals, and a single Market snapshot.
- Read inputs in a repeatable-read, read-only transaction with an explicit
  `analysis_date_basis`; never mix publication and discovery dates.
- Compare experimental coverage denominators with saved confirmed profiles and
  synthetic users, without
  changing the existing Backend scoring policy.
- Prepare explicitly selected main skills' cited document Context through the
  pipeline retrieval service: skill-filtered embeddings, text-model review,
  source/quote validation and foundation/related mentions with coverage gaps.
- Assemble saved User/Goal/Market inputs with cited knowledge into typed Agent
  Context v0.5, with confirmed project summaries, full-market and Core Top-20 match scores, all-market skill
  assessments, per-skill gap/priority scores, grouped foundations and a deduplicated
  evidence registry. Assembly makes no model calls or database writes.

Use the [Skill Knowledge Context guide](../docs/rag/skill-knowledge-context-guide.md)
for the phase-four CLI and output contract. It is a knowledge preview, not final
personalized Agent Context or a generated Roadmap.

The [Agent Context guide](../docs/rag/agent-context-guide.md) documents the scored
assembly layer and [JSON contract](../docs/rag/agent-context.schema.json). It uses
versioned matching/gap policies shared with the Resume Career Match implementation.
RAG main-skill selection remains an explicit upstream choice; score quality and
document coverage are reported separately.

Use the [stage-one guide](../docs/rag/context-data-guide.md) for commands and
the [implementation progress](../docs/rag/implementation-progress.md) for the
current boundary and remaining work. Full requirements are in the
[Thai specification](../docs/rag/skill-context-spec.md).
