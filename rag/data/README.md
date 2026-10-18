# Local RAG artifacts

Run commands from the `glow-job` root. This directory replaces `rag/.data`.
Git tracks this guide and `.gitkeep` files only. Generated JSON, reports,
checkpoints, and model responses remain local, including artifacts from real CVs.
Cloning the repository creates the folders, not the examples or database data.

## Folder ownership and sources

```text
data/
├── inputs/                 Read-only User/Goal/Market input snapshots
├── scoring/                Experimental score comparison reports
├── knowledge/              Current cited document Context and run sidecars
├── agent-context/          Current assembled Context for the AI team
└── archive/
    ├── knowledge/          Superseded previews and intermediate document runs
    └── agent-context/      Superseded assembled Context
```

| Folder | Produced by | Reads / purpose |
|---|---|---|
| `inputs/` | `python -m scripts.rag.preview_context` | Saved confirmed profiles/goals and one Market snapshot from PostgreSQL. Optional user evidence can be private. |
| `scoring/` | `python -m scripts.rag.compare_match_policies` | Input JSON or a fresh DB snapshot. Compares three experimental skill-presence coverage policies; no production policy is selected. |
| `knowledge/` | `python -m scripts.rag.prepare_skill_context` | Canonical catalog, mapped prepared document chunks, embeddings, reviewed dependencies, and optional Gemini text review. Contains public document evidence, not CV text. |
| `agent-context/` | `python -m scripts.rag.build_agent_context` | Saved knowledge JSON plus live validated evidence and User/Goal/Market inputs. No model calls. Can contain private user evidence and optional answers. |
| `archive/` | Move older artifacts here when replacing a preview | Historical inspection only; do not select an old result merely because its filename matches a skill. |

These commands do not write application records to the database. Demo user seeds
and dependency review/apply are separate, explicit operations.

## Existing local files after reorganization

These are examples from this workspace, not files distributed through Git.

| Path | What it contains / where it came from |
|---|---|
| `inputs/market-inputs.json` | Read-only Market input preview for the scoring experiment. |
| `scoring/comparison.json` | Initial comparison using synthetic scenarios constructed from the Market snapshot. |
| `scoring/demo-student-comparison.json` and `.md` | Comparison using the saved synthetic student profile, alongside synthetic scenarios. |
| `scoring/my-resume-comparison.md` | Local comparison from a confirmed uploaded CV; keep private. |
| `knowledge/knowledge-context-demo-v3.json`, `.md`, `.schema.json` | Current combined Airflow/RAG/Java knowledge preview. All three skills have partial coverage; Java has topic outlines only. |
| `knowledge/knowledge-context-demo-v3.assembly.json` | Original assembly provenance: Airflow/RAG reused from demo-v2, Java from java-v3. Its historical source basenames now resolve under `archive/knowledge/`. |
| `agent-context/agent-context-demo-student-v2.json`, `.md`, `.schema.json` | Current synthetic student Context, built from demo-v3 knowledge and live DB reads. |
| `agent-context/agent-context-demo-unknown-v1.json`, `.md`, `.schema.json` | Current synthetic career-changer Context with unknown proficiency retained. |
| `archive/knowledge/knowledge-context-demo-v1.*` and `knowledge-context-demo-v2.*` | Earlier document previews, their checkpoints, and raw response directories. |
| `archive/knowledge/knowledge-context-java-v3.*` | Separate Java review run reused in the current combined preview; includes checkpoint/schema/raw responses. |
| `archive/agent-context/agent-context-demo-student-v1.*` | Earlier student Context and generated contract snapshot. |

Artifact contents were preserved during the move, including recorded hashes and
historical source names. A version suffix is a local example version, not a schema
version or an automatic guarantee of freshness. Context assembly rechecks live
catalog/source/chunk data and can reject an old knowledge file.

## Sidecars stay with their run

For `knowledge/my-run.json`, keep `my-run.md`, `my-run.schema.json`,
`my-run.partial.json`, and `my-run.responses/` in the same folder. A partial file
is a checkpoint, not a complete Context; the current CLI does not automatically
resume it. Raw responses are unvalidated model output. An `.assembly.json`, when
present, documents local reuse of earlier per-skill results.

For Agent Context, share the intended final `.json` and its schema with the AI
team; `.md` is a readable view. The authoritative versioned contracts are in
[`docs/rag`](../../docs/rag/), not a historical generated schema snapshot.
Agent Context still has `status=preview_pending_policies`: production scoring,
automatic main-skill selection, and Roadmap generation are separate work.

## New output paths

Use a new filename for each run. These examples show output locations, not a full
end-to-end command sequence:

```cmd
python -m scripts.rag.preview_context --career-profile-id 1 --date-basis first_seen_at --output rag/data/inputs/market-inputs-new.json
python -m scripts.rag.compare_match_policies --input rag/data/inputs/market-inputs-new.json --output rag/data/scoring/comparison-new.md --json-output rag/data/scoring/comparison-new.json
python -m scripts.rag.prepare_skill_context --skill "Apache Airflow" --review --output rag/data/knowledge/my-skill-context.json
python -m scripts.rag.build_agent_context --profile-id prf_demo_student_data --career-profile-id 1 --date-basis first_seen_at --knowledge rag/data/knowledge/my-skill-context.json --output rag/data/agent-context/my-agent-context.json
```

For Docker, mount `%CD%/rag/data:/output` and use the same category underneath
`/output`, for example `/output/knowledge/my-skill-context.json`.
Full prerequisites/options are in the [input guide](../../docs/rag/context-data-guide.md),
[knowledge guide](../../docs/rag/skill-knowledge-context-guide.md), and
[Agent Context guide](../../docs/rag/agent-context-guide.md).

Document ingestion outputs, embeddings, and dependency review queues remain in
`data-pipeline/data/`; they are not duplicated here. In particular, the reviewed
dependency queue and DB receipt live under
`data-pipeline/data/processed/skill_dependencies/`.
