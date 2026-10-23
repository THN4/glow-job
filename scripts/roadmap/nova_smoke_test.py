"""Test Nova through Bedrock Converse. No profile data is sent. Requires --allow-spend.

Run from the repo root using backend/.venv. Environment variables are read from
the process, not automatically from .env files.
"""

from __future__ import annotations

import argparse
import json
import os
import time


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default=os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION") or "us-east-1")
    parser.add_argument("--model", default=os.getenv("BEDROCK_ROADMAP_MODEL") or "amazon.nova-pro-v1:0")
    parser.add_argument("--allow-spend", action="store_true", help="Make one billed model request")
    args = parser.parse_args()
    if not args.allow_spend:
        parser.error("this makes a billed Bedrock request; add --allow-spend to confirm")

    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError, ClientError

    started = time.monotonic()
    try:
        client = boto3.client("bedrock-runtime", region_name=args.region, config=Config(
            retries={"total_max_attempts": 3, "mode": "adaptive"}, connect_timeout=10, read_timeout=120,
        ))
        response = client.converse(
            modelId=args.model,
            messages=[{"role": "user", "content": [{"text": "Reply with only: Python connected"}]}],
            inferenceConfig={"maxTokens": 30, "temperature": 0},
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "Unknown")
        print(f"FAILED: {code}. Check model access, bedrock:InvokeModel permissions, and the model/profile ID in this region.")
        return 1
    except BotoCoreError as error:
        print(f"FAILED: {type(error).__name__}. Check the AWS credential chain and network connection.")
        return 1

    text = "".join(block.get("text", "") for block in response.get("output", {}).get("message", {}).get("content", []))
    success = text.strip() == "Python connected" and response.get("stopReason") == "end_turn"
    print(json.dumps({"ok": success, "model": args.model, "region": args.region,
                      "text": text, "stopReason": response.get("stopReason"),
                      "usage": response.get("usage", {}), "seconds": round(time.monotonic() - started, 2)}, indent=2))
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
