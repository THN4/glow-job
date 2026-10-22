"""One tiny Claude call on Amazon Bedrock, to check access before turning roadmap generation on.

It costs a fraction of a cent (about 30 input tokens and a short reply, with thinking at low effort).
Run it with the backend virtualenv's Python from the repository root:

    python -m scripts.roadmap.bedrock_smoke_test --region ap-southeast-1 --allow-spend

It reports which credentials the SDK found, the endpoint it called, the tokens used and what the
call would cost at the configured prices, and explains the common failures.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai.roadmap.cost import Pricing, estimate_cost  # noqa: E402
from ai.roadmap.providers import DEFAULT_BEDROCK_MODEL, Usage  # noqa: E402

HINTS = {
    "AuthenticationError": "The credentials were rejected. Check that they are current (SSO session or bearer token expired?).",
    "PermissionDeniedError": "Authenticated but not allowed. The role needs the bedrock-mantle:CreateInference permission, "
                             "and Claude Opus 5.5 must be enabled for this account (Bedrock console > Model access).",
    "NotFoundError": "Model or endpoint not found. Check the region and the model ID, and that Opus 5.5 is offered in that region.",
    "BadRequestError": "The request was refused as invalid. Read the message; it often names the missing access or setting.",
    "RateLimitError": "Throttled. Wait a minute and retry; check the account quota for this model.",
    "APIConnectionError": "Could not reach the endpoint. Check the region name and the network or proxy.",
}


def credential_source() -> str:
    if os.environ.get("AWS_BEARER_TOKEN_BEDROCK") is not None:
        return "Bedrock bearer token (AWS_BEARER_TOKEN_BEDROCK)"
    if os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("AWS_PROFILE"):
        return "AWS access keys or profile from the environment (SigV4)"
    if os.environ.get("AWS_WEB_IDENTITY_TOKEN_FILE") or os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"):
        return "an IAM role from the runtime (SigV4)"
    return "the default AWS credential chain (shared config, SSO, instance role)"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--region", default=os.environ.get("AWS_REGION") or os.environ.get("ROADMAP_AWS_REGION"),
                        required=not (os.environ.get("AWS_REGION") or os.environ.get("ROADMAP_AWS_REGION")))
    parser.add_argument("--model", default=os.environ.get("ROADMAP_MODEL_ID") or DEFAULT_BEDROCK_MODEL)
    parser.add_argument("--effort", choices=("low", "medium", "high"), default="low")
    parser.add_argument("--input-price", type=float, default=float(os.environ.get("ROADMAP_PRICE_INPUT_PER_MTOK", 4.0)),
                        help="USD per million input tokens, for the cost estimate")
    parser.add_argument("--output-price", type=float, default=float(os.environ.get("ROADMAP_PRICE_OUTPUT_PER_MTOK", 20.0)),
                        help="USD per million output tokens, for the cost estimate")
    parser.add_argument("--allow-spend", action="store_true", help="Required: this makes one real, billed call")
    args = parser.parse_args()
    if not args.allow_spend:
        parser.error("this makes one real Bedrock call that is billed; add --allow-spend to confirm")

    import anthropic
    from anthropic import AnthropicBedrockMantle

    print(f"Region:      {args.region}")
    print(f"Model:       {args.model}")
    print(f"Credentials: {credential_source()}")
    started = time.monotonic()
    try:
        client = AnthropicBedrockMantle(aws_region=args.region)
        print(f"Endpoint:    {client.base_url}")
        with client.messages.stream(
            model=args.model,
            max_tokens=1500,
            thinking={"type": "adaptive"},
            output_config={"effort": args.effort},
            messages=[{"role": "user", "content": "Reply with the single word OK."}],
        ) as stream:
            message = stream.get_final_message()
    except anthropic.APIStatusError as err:
        print(f"\nFAILED: HTTP {err.status_code} {type(err).__name__}: {err.message}")
        print("Hint:  " + HINTS.get(type(err).__name__, "See the message above."))
        return 1
    except anthropic.APIConnectionError as err:
        print(f"\nFAILED: {type(err).__name__}: {err}")
        print("Hint:  " + HINTS["APIConnectionError"])
        return 1
    except Exception as err:  # noqa: BLE001 - usually missing or expired AWS credentials
        print(f"\nFAILED before sending: {type(err).__name__}: {err}")
        print("Hint:  No usable AWS credentials were found. Sign in (aws sso login), set AWS_BEARER_TOKEN_BEDROCK, "
              "or run where an IAM role is attached.")
        return 1

    text = "".join(block.text for block in message.content if block.type == "text").strip()
    usage = Usage()
    usage.add(message.usage)
    cost = estimate_cost(usage, Pricing(args.input_price, args.output_price), provider="bedrock")
    print(f"\nOK in {time.monotonic() - started:.1f}s. Stop reason: {message.stop_reason}. Reply: {text!r}")
    print(f"Tokens: {usage.input_tokens} in, {usage.output_tokens} out. "
          f"Estimated cost: ${cost:.5f} at ${args.input_price:g} / ${args.output_price:g} per million tokens.")
    print("Next: open Cost Explorer or the Bedrock usage page in a day and confirm this call appears, and that "
          "credits (if any) were applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
