# Local RAG artifacts

Run commands from the `glow-job` root. Git tracks this guide and `.gitkeep` files;
generated JSON, reports, checkpoints, model responses and profile-specific outputs
stay local because they can contain private onboarding data.

## Folder layout

```text
data/
├── inputs/                         Read-only User/Goal/Market snapshots
├── scoring/                        Experimental score comparison reports
├── knowledge/
│   ├── examples/                   Reusable synthetic/document examples
│   └── users/<profile-fragment>/   User-specific RAG knowledge and sidecars
├── agent-context/
│   ├── examples/                   Synthetic Agent Context examples
│   └── users/<profile-fragment>/   User-specific assembled Context snapshots
└── archive/                        Historical previews superseded by current ones
```

| Folder | Produced by | Contents |
|---|---|---|
| `inputs/` | `scripts.rag.preview_context` | Read-only profile/goal/market input snapshots. Optional evidence excerpts can be private. |
| `scoring/` | `scripts.rag.compare_match_policies` | Historical policy comparisons. Current Agent Context scoring policy is v0.4; these reports are not its live output. |
| `knowledge/examples/` | `scripts.rag.prepare_skill_context` | Reusable examples grounded in mapped document chunks. |
| `knowledge/users/<profile-fragment>/` | RAG preparation/review | User-specific skill selection and reviewed knowledge. Keep `.json`, `.md`, `.schema.json`, `.partial.json`, `.responses/`, and `.assembly.json` together when they belong to one run. |
| `agent-context/examples/` | `scripts.rag.build_agent_context` | Synthetic examples validated against the Agent Context schema. |
| `agent-context/users/<profile-fragment>/` | `scripts.rag.build_agent_context` | Assembled profile, career, full market scores, selected skill gaps and cited RAG context. Treat as private. |
| `archive/` | Manual local housekeeping | Prior previews retained only when useful for audit/history; never use an archived file as current input. |

These commands do not write application records to PostgreSQL. Demo user seeds and
dependency review/apply are separate operations. Generated data is ignored by Git;
the `.gitkeep` files make the folder structure available after clone.

## Current local examples

- `knowledge/examples/knowledge-context-demo-v3.json` and its sidecars: Airflow,
  RAG and Java document evidence for a synthetic profile.
- `agent-context/examples/agent-context-demo-student-v3.json` and its sidecars:
  schema v0.4 synthetic Agent Context used by the Roadmap consumer fixture.
- `knowledge/users/prf_bddf4db6/`: reviewed RAG context for one real profile.
- `agent-context/users/prf_bddf4db6/`: its latest scored Agent Context snapshot.
- `inputs/market-inputs.json` and `scoring/`: local Market preview and historical
  score comparisons.

The profile-specific examples are local to this workspace and are not distributed
through Git. Do not copy them as another user's knowledge or context.

## Naming and cleanup rules

Use one folder per profile fragment for all user-specific artifacts. Give each
generated snapshot a dated or versioned filename, retain the exact source RAG JSON
used to build it, and remove superseded duplicate runs after checking no current
command or guide references them. Do not mix raw model responses with final reviewed
knowledge. An `.assembly.json` documents local reuse of earlier per-skill results.

For `knowledge/my-run.json`, keep sidecars beside it. For user-specific runs, put
them under `knowledge/users/<profile-fragment>/my-run.json`. Context output follows
the same rule under `agent-context/users/<profile-fragment>/`.

Example commands:

```cmd
python -m scripts.rag.prepare_skill_context --skill "Apache Airflow" --review --output rag/data/knowledge/examples/my-skill-context.json
python -m scripts.rag.build_agent_context --profile-id prf_demo_student_data --career-profile-id 1 --date-basis first_seen_at --knowledge rag/data/knowledge/examples/knowledge-context-demo-v3.json --output rag/data/agent-context/users/prf_demo_student_data/agent-context.json
```

For Docker, mount `%CD%/rag/data:/output` and use the equivalent path under
`/output`. Full options are in the [input guide](../../docs/rag/context-data-guide.md),
[knowledge guide](../../docs/rag/skill-knowledge-context-guide.md), and
[Agent Context guide](../../docs/rag/agent-context-guide.md).

Document extraction outputs, embeddings and dependency review records remain under
`data-pipeline/data/`; they are not duplicated here.
