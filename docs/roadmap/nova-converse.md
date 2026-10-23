# Nova Pro roadmap generation through Bedrock Converse

This changes roadmap generation only. CV extraction, query/document embeddings,
RAG review, validation, storage and the frontend remain on their existing paths.
The existing `bedrock` provider remains Claude Mantle; use `bedrock_converse` for Nova.

## Configuration

Docker Compose reads the root `.env`; Python launched in `backend` reads
`backend/.env`. CLI commands read the process environment and arguments only.
No secrets need to be placed inside `ai` or `rag`.

```dotenv
ROADMAP_PROVIDER=bedrock_converse
AWS_DEFAULT_REGION=us-east-1
BEDROCK_ROADMAP_MODEL=amazon.nova-pro-v1:0
ROADMAP_MODEL_ID=
ROADMAP_AWS_REGION=
ROADMAP_PRICE_INPUT_PER_MTOK=
ROADMAP_PRICE_OUTPUT_PER_MTOK=
```

`ROADMAP_MODEL_ID` overrides `BEDROCK_ROADMAP_MODEL` when nonempty. Clear an old
Gemini model override before switching. Region precedence is `ROADMAP_AWS_REGION`,
`AWS_DEFAULT_REGION`, then `AWS_REGION`. Keep `GEMINI_API_KEY` for existing CV/RAG.

The SDK uses the AWS credential chain. On the host, use your existing AWS profile
(SSO/assumed role). Containers cannot automatically see the host's SSO files.
For local Docker, export temporary AWS credentials into the shell and use:

```powershell
docker compose -f compose.yaml -f compose.nova-local.yaml up -d --build --no-deps backend
```

This opt-in override selects Nova and passes shell credentials without persisting
them in source files. For deployment use an ECS task or EC2 instance role. Never
commit credentials, or run `docker compose config` into shared logs containing secrets.

If the host SDK uses `aws login` or SSO/profile files instead of shell credentials,
use the optional read-only profile mount (the directory stays outside the repo):

```powershell
$env:AWS_CONFIG_DIR = Join-Path $env:USERPROFILE '.aws'
# Set AWS_PROFILE to the profile you logged into, if it is not default.
docker compose -f compose.yaml -f compose.nova-local.yaml -f compose.nova-profile-local.yaml up -d --build --no-deps backend
```

The profile override mounts the host AWS configuration only into this local
backend container. Log in again on the host if its session expires; do not use
this host-directory mount for deployment. Environment credentials take precedence
over profile credentials, so clear stale AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY/SESSION_TOKEN
variables when testing a login/SSO profile.

The caller needs `bedrock:InvokeModel`. If direct invocation isn't supported for
your account/model, set `BEDROCK_ROADMAP_MODEL=us.amazon.nova-pro-v1:0` explicitly.
This US inference profile can route to its permitted US destination regions;
permissions must cover the profile and its destination models. No automatic
cross-region fallback is performed.

The DB role also needs SELECT/INSERT/UPDATE on `system.ai_runs` and USAGE on its
identity sequence, plus existing roadmap persistence rights. This integration
does not grant database permissions or change schemas.

## Tests

From the repo root, test AWS access with synthetic text only (billed):

```powershell
.\backend\.venv\Scripts\python.exe -m scripts.roadmap.nova_smoke_test --region us-east-1 --model amazon.nova-pro-v1:0 --allow-spend
```

Then generate from the committed sample context, not a real CV (also billed):

```powershell
.\backend\.venv\Scripts\python.exe -m ai.roadmap.cli --provider bedrock_converse --aws-region us-east-1 --model amazon.nova-pro-v1:0 --context ai/roadmap/fixtures/agent-context-demo-student.json --output rag/data/nova-roadmap.json --allow-spend
```

Run API end-to-end afterwards: save goal, create roadmap job, poll until success,
load current roadmap, and check node IDs, exact citations and dependency gating.
Do not accept output only because it is valid JSON: the shared semantic validator
still runs, with at most one repair for a structurally valid but inconsistent draft.
Invalid JSON, refusal, and truncated output fail without storing a partial roadmap.

Nova v1 permits at most 5,000 output tokens. The adapter caps the existing 24k
setting to 5k; long roadmaps may fail with output truncation rather than being
silently shortened. Effort/thinking/cache settings for Claude aren't sent to Nova.
The network timeout is 120 seconds per attempt, with up to three adaptive SDK
attempts; this is not a 120-second total job deadline.

Usage accumulates across generation and semantic repair and uses the existing
`system.ai_runs` accounting. Nova Pro defaults to an estimated $0.80/$3.20 per
million input/output tokens; explicit `ROADMAP_PRICE_*` settings override them.
The local Docker override uses `NOVA_PRICE_*` to avoid old Gemini settings.
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
