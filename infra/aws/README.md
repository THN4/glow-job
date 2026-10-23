# AWS permissions for scheduled JSearch ingestion

The ingestion process writes one complete raw JSearch response per configured
search query. For the current bucket, set these environment variables on the
EC2 process or container:

```text
RAW_S3_BUCKET=glow-job-raw-data
RAW_S3_PREFIX=raw/jsearch
AWS_DEFAULT_REGION=<the bucket's AWS region>
```

Attach `ec2-jsearch-s3-write-policy.json` to the IAM role in the EC2 instance
profile used by the ingestion worker. It grants `s3:PutObject` only under
`glow-job-raw-data/raw/jsearch/`. It does not grant bucket listing, reading,
deletion, or public access.

Use the EC2 instance profile for AWS credentials. Do not put access keys in the
container image, source code, or `.env` file. The bucket should remain private
and should use its default server-side encryption setting.

Before enabling a recurring EventBridge schedule, verify that the bucket exists
in the configured region and that the instance is online as a Systems Manager
managed node. The schedule's role is separate: it will need permission to send
the selected SSM command to the intended EC2 instance.
