# Nova Pro for CV extraction and RAG text review

The CV extractor and the RAG evidence-review transport now support Nova Pro
through Bedrock Converse. The existing final-roadmap provider remains Nova Pro.
No frontend, API, database schema, retrieval/ranking policy, prompt rules,
profile normalization, citation validation or persistence logic is changed.

## Model boundary

| Stage | Model |
| --- | --- |
| CV text / scanned-image extraction | `amazon.nova-pro-v1:0` |
| Query and stored-document embeddings | **Unchanged:** `gemini-embedding-2`, 768 dimensions |
| RAG evidence review | `amazon.nova-pro-v1:0` |
| Final roadmap generation | Existing Nova Pro provider |

Other pipeline jobs (market extraction and dependency extraction) and optional
assessment generation retain their existing providers. Keep `GEMINI_API_KEY`:
live retrieval still requires it. No re-embedding or migration is needed.

## Configuration

For direct Python execution, set these environment variables (or configure the
existing `.env` belonging to the working directory):

```dotenv
RESUME_EXTRACTOR=bedrock_converse
BEDROCK_EXTRACTION_MODEL=amazon.nova-pro-v1:0
BEDROCK_RAG_MODEL=amazon.nova-pro-v1:0
RESUME_BEDROCK_TIMEOUT_MS=180000
AWS_DEFAULT_REGION=us-east-1
```

The extraction model and RAG model are independently configurable; an account
requiring an inference profile can supply `us.amazon.nova-pro-v1:0`. An explicit
`AWS_REGION` takes precedence for these two adapters; otherwise they use
`AWS_DEFAULT_REGION`, defaulting to `us-east-1`.

Default local `docker compose` automatically loads the Nova override, selects
`bedrock_converse` for CV extraction, and reuses the existing AWS profile/cache
mount. It selects Pro for both new model variables unless explicitly overridden:

```powershell
docker compose up -d --build --no-deps backend
```

With explicit `-f compose.yaml`, set `RESUME_EXTRACTOR=bedrock_converse` yourself
and provide AWS credentials/role as appropriate. Mock and legacy Gemini CV
extraction remain available explicitly. RAG text review now defaults to Nova;
retrieval without text review still performs no generation call.

## Provider compatibility

CV uses the same system/user instructions and `CvExtraction` JSON schema. The
schema is included in the Converse system instruction and its inlined form is
passed to a forced `submit_cv` tool instead of Gemini's `response_json_schema`
parameter. The tool only carries the result; it executes no external action.
Nova accepts only `type`, `properties`, and `required` at the tool schema's top
level; the complete strict contract is still enforced by Pydantic. Unexpected,
missing or multiple tool outputs are rejected. Pydantic validates output and allows
one schema repair. Ordered mixed text/image pages and omitted-page notices
are retained. boto3 runs off the async event loop. Usage and model/provider
metadata are retained, and provider/model identity separates CV cache entries.
The cache identity includes the structured-response format version. Validation
logs record only schema field names and error types, never CV field values or
unrecognized model-generated property names. Failed output still receives one
repair attempt; validation rules are not relaxed.

Nova v1 has a 5000-token output cap, so the adapter uses 5000 instead of the
Gemini adapter's 8192. Truncated, filtered and empty responses are rejected;
partial profiles are never silently accepted. SDK retries are bounded to three
total attempts. Provider errors do not expose source documents or credentials.

RAG sends its existing prompt unchanged, then uses the existing JSON and exact
quote validators and its existing one repair attempt. Query/document embedding
code and compatible-vector filtering remain unchanged. Preview metadata reports
the RAG text model separately from the Gemini embedding model.

Converse image blocks follow the [AWS Converse API documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).

## Offline checks

From the root in PowerShell:

```powershell
$env:PYTHONPATH = "$PWD\data-pipeline;$PWD"
.\backend\.venv\Scripts\python.exe -m pytest data-pipeline/tests/resume data-pipeline/tests/shared/test_gemini_client.py data-pipeline/tests/shared/test_bedrock_client.py data-pipeline/tests/shared/test_nova_skill_context.py -q -p no:cacheprovider
```

The tests use synthetic inputs/fake clients; they do not upload a real CV or
write to the application database. A paid live smoke test should likewise use
synthetic CV text and an artificial source passage, and validate both returned
contracts before relying on the UI flow.

With the backend running, the opt-in synthetic live test is:

```powershell
Get-Content -Raw scripts/roadmap/nova_cv_rag_smoke_test.py | docker compose exec -T backend python - --allow-spend
```

It makes paid model calls, never queries the database, and does not invoke or
change Gemini embeddings. The synthetic CV schema and RAG exact-quote checks
have been verified against `amazon.nova-pro-v1:0` in the local container.
