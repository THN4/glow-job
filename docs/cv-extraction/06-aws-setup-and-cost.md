# 6. AWS Deployment & Cost

> **Historical planning only.** Current resume extraction uses the shared Gemini
> API. The model-hosting and cost options below were written for the earlier
> Qwen prototype and are not current deployment guidance.

**At the time of this plan:** everything ran locally and AWS was not used.
This page records possible AWS hosting options considered against the **$350
credit** at that time.

## 6.1 What gets deployed

Everything except the model is cheap serverless (see [02-architecture.md](02-architecture.md)):

| Service | Expected monthly cost |
|---|---|
| Lambda (API + worker, arm64) | ~$0 (free tier) |
| API Gateway HTTP API | ~$0.01 |
| DynamoDB on-demand | < $0.10 |
| S3 (files live for seconds) | < $0.05 |
| CloudWatch Logs (7-day retention) | < $0.50 |
| **Total without the model** | **< $1 / month** |

**The model is the only real cost decision.**

## 6.2 Options for running the model on AWS

> All prices are rough, for planning only. Check current AWS pricing for your region and instance before deciding.

| Option | How | Cost profile | Pros | Cons |
|---|---|---|---|---|
| **A. Qwen on Amazon Bedrock** (serverless) | If a suitable Qwen model (ideally a VL one) is offered on Bedrock in your region. Add an `EXTRACTOR=bedrock` adapter (AWS SDK Converse API) | Pay per token, roughly **cents per CV**, $0 when idle | Same model family as local, no servers, no idle cost | Check which Qwen models and features (images, JSON output) Bedrock offers in your region |
| **B. Self-hosted Qwen on a GPU EC2 instance** (e.g. `g5.xlarge`, 24 GB A10G) running vLLM | Same `openai-compatible` extractor, with `LLM_BASE_URL` pointing at the instance | **~$1 per hour while running** (on-demand). Left on 24/7 that is **~$700+/month, more than the whole credit in ~2 weeks** | Exactly the same model and setup as local | Must be **started for demos and stopped right after**. New accounts often have **0 GPU quota**, and quota requests can take days. Cold start takes minutes |
| **C. Keep the model on the notebook server**, deploy only the app to AWS | Expose the notebook model to the worker through a secure tunnel (Tailscale / Cloudflare Tunnel) | $0 model cost | Cheapest | The demo depends on the notebook being on and online, and the tunnel needs securing |
| **D. Claude Haiku 4.5 on Bedrock** (serverless) | `EXTRACTOR=bedrock` adapter | ~$0.02 per CV, $0 when idle | Strong on scans/Thai, native PDF input, no servers | Different model from local, so the prompt needs a quick re-check in the eval |

**Recommendation for the $350 credit:** prefer a **serverless option (A or D)**, so cost is near zero when nobody is using the app. If DevOps chooses **B**, automate start/stop (a script, or a scheduled EventBridge rule) and set the budget alerts below **before** launching the instance.

Since the backend selects the model by config (`EXTRACTOR`, `LLM_BASE_URL`, `LLM_MODEL`), any option can be tried without changing business logic.

## 6.3 Account setup checklist (at deploy time)

- [ ] **Budget alerts first:** Billing → Budgets → monthly cost budget with email alerts at **$5, $20 and $50** actual spend. Add the whole team.
- [ ] **Credit coverage:** Billing → Credits → applicable products. Check that the services for the chosen option (Bedrock models / EC2 GPU) are covered. Third-party Bedrock models are sometimes excluded.
- [ ] **Region:** one region for the whole stack. `ap-southeast-1` (Singapore) is closest to Thailand, but check the chosen model or GPU instance is available there.
- [ ] **Option A/D:** request model access in the Bedrock console and note the model ID.
- [ ] **Option B:** request a GPU instance quota increase early ("Running On-Demand G and VT instances"), and put the instance in a private subnet/security group reachable only by the worker Lambda.
- [ ] **Team access:** IAM Identity Center or IAM users with MFA, not the root account.
- [ ] `npx cdk bootstrap aws://<account-id>/<region>`, then `npx cdk deploy`.
- [ ] Tag everything `project=glow-job` so Cost Explorer can show what this feature costs.
- [ ] After the event: `cdk destroy`, and terminate any GPU instance.

## 6.4 Cost guardrails built into the design

| Guardrail | Where |
|---|---|
| Local Qwen / mock for all development, tests and eval | `EXTRACTOR` config |
| Text-first PDFs, image downscaling, ≤ 10 pages (≤ 4 in image mode) | `cv_extraction/preprocess.py` |
| `max_tokens: 4096` | extractor |
| Hash cache (24 h), so the same file is never processed twice | `CACHE#<sha256>` |
| Daily extraction cap once deployed (`DAILY_EXTRACTION_LIMIT`, e.g. 50) | `COUNTER#<date>` → `429 DAILY_LIMIT_REACHED` |
| API throttling (5 rps, burst 10) | API Gateway |
| Budget alerts $5 / $20 / $50 | AWS Budgets |
| No always-on resources (no NAT, RDS, OpenSearch, WAF; a GPU only while demoing) | CDK review |
