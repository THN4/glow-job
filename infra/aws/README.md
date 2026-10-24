# AWS permissions for scheduled JSearch ingestion

## Complete Market pipeline worker

For API ingestion through database loading and Market aggregation, use the new
[scheduled pipeline guide](../../data-pipeline/docs/market/scheduled-pipeline-guide.md).
The entry point is:

```bash
bash /opt/glow-job/data-pipeline/scripts/market/run_scheduled_pipeline.sh --live --dry-run
bash /opt/glow-job/data-pipeline/scripts/market/run_scheduled_pipeline.sh --live
```

Use `ec2-market-pipeline-s3-policy.json` for this worker: it permits PutObject and
GetObject for raw JSearch responses and Market run artifacts under
`market/pipeline-runs/`, with ListBucket restricted to those prefixes.
Listing an exact key prefix distinguishes missing objects from IAM failures
during recovery. Update the bucket/prefix resources and conditions when
using a different destination. The existing write-only policy below continues to
describe upload-only ingestion.

The Python command owns the worker lock, run journal, default UTC window and
resume behavior. Cron deployment, timezone, external alerts and live verification
are later setup steps. The EventBridge template below still targets the old
**extraction-only** runner; select `run_scheduled_pipeline.sh --live` explicitly
when using the complete worker. Disable the old schedule before enabling cron.

The ingestion process writes one complete raw JSearch response per configured
search query. For the current bucket, set these environment variables on the
EC2 process or container:

```text
RAW_S3_BUCKET=glow-job-raw-data
RAW_S3_PREFIX=raw/jsearch
AWS_DEFAULT_REGION=<the bucket's AWS region>
JSEARCH_SECRET_ID=<Secrets Manager secret name or ARN>
```

Attach `ec2-jsearch-s3-write-policy.json` to the IAM role in the EC2 instance
profile used by the ingestion worker. It grants `s3:PutObject` only under
`glow-job-raw-data/raw/jsearch/`. It does not grant bucket listing, reading,
deletion, or public access.

Use the EC2 instance profile for AWS credentials. Do not put access keys in the
container image, source code, or `.env` file. The bucket should remain private
and should use its default server-side encryption setting.
Store the RapidAPI key as the complete plaintext value of a Secrets Manager
`SecretString`; the worker loads it through `JSEARCH_SECRET_ID`. The EC2 role
also needs `secretsmanager:GetSecretValue` scoped to that secret.

Before enabling a recurring EventBridge schedule, verify that the bucket exists
in the configured region and that the instance is online as a Systems Manager
managed node. The schedule's role is separate: it will need permission to send
the selected SSM command to the intended EC2 instance.

## EventBridge schedule for an EC2 worker

`eventbridge-ec2-schedule.yaml` creates an EventBridge Scheduler schedule whose
universal target calls Systems Manager `SendCommand` with the
`AWS-RunShellScript` document. The template scopes the scheduler role to the
single `WorkerInstanceId` parameter and starts with the schedule disabled.

Deploy it only after the EC2 worker is online in Systems Manager and the runner
script exists at `WorkerCommand` (default:
`bash /opt/glow-job/data-pipeline/scripts/market/run_scheduled_ingestion.sh`).
The script expects the `data-pipeline` checkout at
`/opt/glow-job/data-pipeline` and uses its `.venv/bin/python`, falling back to
`python3`. The default schedule is daily at
08:00 Bangkok time. Keep `ScheduleState=DISABLED` for deployment; enable it only
after a manual SSM run succeeds and writes objects to the expected S3 prefix.

Scheduler retry settings cover failures invoking the SSM API. The API returns
before the shell command finishes, so also monitor the SSM command invocation
status and its output in Systems Manager/CloudWatch.
