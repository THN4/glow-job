# Nova 2 Lite roadmap generation through Bedrock Converse

This page documents final roadmap generation. CV extraction and RAG text review
use Nova 2 Lite in the default local setup; see [CV/RAG configuration](nova-cv-rag.md).
Query/document embeddings use Gemini Embedding 2 by default; validation, storage and
the frontend retain their existing paths.
The existing `bedrock` provider remains Claude Mantle; use `bedrock_converse` for Nova.

## Default local startup

`compose.override.yaml` is loaded automatically by ordinary `docker compose`.
It selects Nova 2 Lite even if the root `.env` still contains a legacy Gemini
ROADMAP_PROVIDER/MODEL_ID. It passes `AWS_BEARER_TOKEN_BEDROCK` from the root
`.env`; the optional host profile mount remains available as an alternate auth
method. Normal local startup is:

```powershell
docker compose up -d --build --no-deps backend
```

Database settings come from the base Compose file and root environment; this
override does not force a local database. For RDS through a host SSH tunnel,
use `DB_HOST=host.docker.internal` and `DB_TARGET_PORT` for the tunnel's host
port, plus `DB_TARGET_NAME`, `DB_TARGET_USER` and `DB_TARGET_PASSWORD`. Keep
the tunnel running throughout context preparation, generation and saving.

The AWS directory defaults to the user's `.aws` directory (`USERPROFILE` on
Windows, `HOME` elsewhere); AWS_CONFIG_DIR and AWS_PROFILE can override it.
No secret values are stored in this Compose file. Explicit `-f compose.yaml`
does not load the automatic override; configure its provider and runtime AWS
role explicitly for deployment. To use an alternate provider locally, likewise
select the base Compose file explicitly rather than the default local override.

## Configuration

Docker Compose reads the root `.env`; Python launched in `backend` reads
`backend/.env`. CLI commands read the process environment and arguments only.
No secrets need to be placed inside `ai` or `rag`.

```dotenv
ROADMAP_PROVIDER=bedrock_converse
AWS_DEFAULT_REGION=us-east-1
AWS_BEARER_TOKEN_BEDROCK=<your-bedrock-api-key>
BEDROCK_ROADMAP_MODEL=us.amazon.nova-2-lite-v1:0
ROADMAP_MODEL_ID=
ROADMAP_AWS_REGION=
ROADMAP_PRICE_INPUT_PER_MTOK=
ROADMAP_PRICE_OUTPUT_PER_MTOK=
```

`ROADMAP_MODEL_ID` overrides `BEDROCK_ROADMAP_MODEL` when nonempty. Clear an old
Gemini model override before switching. Region precedence is `ROADMAP_AWS_REGION`,
`AWS_DEFAULT_REGION`, then `AWS_REGION`. `GEMINI_API_KEY` is only needed by other
Gemini-backed pipeline jobs.

For local inference, Boto3 reads `AWS_BEARER_TOKEN_BEDROCK` and sends the Bedrock
API key with the existing Converse request. `OPENAI_BASE_URL` is not needed for
Nova through this native Bedrock API. Keep the key in the ignored root `.env`;
Compose passes it into the backend container. AWS also supports short-term API
keys that expire with the session and long-term keys for exploration.

If you use temporary AWS credentials instead of an API key, use:

```powershell
docker compose -f compose.yaml -f compose.nova-local.yaml up -d --build --no-deps backend
```

This opt-in override selects Nova and passes shell credentials. For deployment,
use a task or instance role when appropriate. Never commit credentials, or run
`docker compose config` into shared logs containing secrets.

If you use AWS SSO/profile files instead of the API key, use the optional profile
mount (the directory stays outside the repo):

```powershell
$env:AWS_CONFIG_DIR = Join-Path $env:USERPROFILE '.aws'
# Set AWS_PROFILE to the profile you logged into, if it is not default.
docker compose -f compose.yaml -f compose.nova-local.yaml -f compose.nova-profile-local.yaml up -d --build --no-deps backend
```

The profile override mounts the host AWS configuration read-only into this local
backend container, with a writable submount only for `login/cache`. AWS login
must save refreshed tokens atomically in that directory, otherwise an initially
working session fails when it reaches its mandatory refresh window. Files such
as `config` and `credentials` remain read-only. Log in again on the host if the
login session itself expires; do not use this host-directory mount for deployment.
For SSO profiles, refresh SSO on the host; this override only makes the AWS login
cache writable. Environment credentials take precedence
over profile credentials, so clear stale AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY/SESSION_TOKEN
variables when testing a login/SSO profile.

The caller needs `bedrock:InvokeModel`. If the selected profile is unavailable,
verify Bedrock model access and region for `us.amazon.nova-2-lite-v1:0`.
This US inference profile can route to its permitted US destination regions;
permissions must cover the profile and its destination models. No automatic
cross-region fallback is performed.

The DB role also needs SELECT/INSERT/UPDATE on `system.ai_runs` and USAGE on its
identity sequence, plus existing roadmap persistence rights. This integration
does not grant database permissions or change schemas.

## Tests

From the repo root, test AWS access with synthetic text only (billed):

```powershell
.\backend\.venv\Scripts\python.exe -m scripts.roadmap.nova_smoke_test --region us-east-1 --model us.amazon.nova-2-lite-v1:0 --allow-spend
```

Then generate from the committed sample context, not a real CV (also billed):

```powershell
.\backend\.venv\Scripts\python.exe -m ai.roadmap.cli --provider bedrock_converse --aws-region us-east-1 --model us.amazon.nova-2-lite-v1:0 --context ai/roadmap/fixtures/agent-context-demo-student.json --output rag/data/nova-roadmap.json --allow-spend
```

Run API end-to-end afterwards: save goal, create roadmap job, poll until success,
load current roadmap, and check node IDs, exact citations and dependency gating.
Do not accept output only because it is valid JSON: the shared semantic validator
still runs, with at most one repair for a structurally valid but inconsistent draft.
Invalid JSON, refusal, and truncated output fail without storing a partial roadmap.

Completed profile skills use up to three reviewed RAG claims and their exact
citations, copied by the server. Models return `details: []` for those baseline
cards instead of regenerating quotes. New learning tasks still require model
citations to match their source and skill exactly. Compacted claims include their
reviewed quotes so the model can copy them without reconstructing citations.
No evidence checks are disabled.

Nova v1 permits at most 5,000 output tokens. The adapter caps the existing 24k
setting to 5k; long roadmaps may fail with output truncation rather than being
silently shortened. Effort/thinking/cache settings for Claude aren't sent to Nova.
The network timeout is 120 seconds per attempt, with up to three adaptive SDK
attempts; this is not a 120-second total job deadline.

Usage accumulates across generation and semantic repair and uses the existing
`system.ai_runs` accounting. Nova 2 Lite defaults to an estimated $0.33/$2.75 per
million input/output tokens; explicit `ROADMAP_PRICE_*` settings override them.
Other Converse models need explicit prices. These estimates aren't an AWS billing
cap and exclude the existing RAG calls; verify rates and billing in AWS.

Rollback: set `ROADMAP_PROVIDER=gemini`, restore its model/prices, and recreate
backend without `compose.nova-local.yaml`. No data migration is needed.

References:
- https://docs.aws.amazon.com/nova/latest/userguide/using-converse-api.html
- https://docs.aws.amazon.com/nova/latest/userguide/complete-request-schema.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html
- https://aws.amazon.com/bedrock/pricing/

## Validation on 2026-10-23

- Live Nova Pro smoke test in `us-east-1`: `Python connected`, 6 input / 3 output tokens.
- The same synthetic request passed inside an ephemeral Docker container using
  the read-only host AWS login profile; the running backend was not replaced.
- Live sample-context roadmap: shared validator passed after one semantic repair,
  18,810 input / 3,119 output tokens over two calls, estimated $0.025029.
  The validator removed one nonmatching citation and reported that warning.
- Runtime DB role: SELECT/INSERT/UPDATE on `system.ai_runs` and sequence USAGE checked.
- Automated Nova/API tests use an in-memory repository and fake Converse responses;
  25 passed. They do not write a live user's roadmap.
- Existing core/API suites have 10 failing assertions about layout/progress/deferred
  skills, reproduced unchanged on baseline `cea226a` in an isolated checkout.
  These predate the Nova changes and remain outside this integration's scope.
- The running backend has not been switched to Nova. No real CV was sent in the live tests.
