# Deploy Glow Job on EC2 with Ubuntu 24.04

Run the React/Vite frontend, Nginx, and FastAPI/systemd backend on one EC2 instance without Docker. An EC2 IAM role is optional when authorized credentials are supplied another way.

This guide uses `glowjob.modnoi.com` as an example. Its DNS configuration has not been verified. Replace the name throughout this guide and `nginx.conf` if using another subdomain.

```text
HTTPS -> Nginx -> /       frontend build
              -> /api/  127.0.0.1:8787 FastAPI -> DB / Bedrock
```

These files have not been tested on a live EC2 instance. They do not create AWS resources, databases, DNS records, or GitHub Actions workflows. Automatic deployment on push requires a separate workflow.

## 1. Prepare the instance

- Use Ubuntu 24.04 and Python 3.12.
- Install Node.js 24 LTS system-wide so `glowjob` can run `node` and `npm`. Installing nvm only for `ubuntu` is insufficient.
- Allow outbound internet access for dependencies and AI requests.
- Allow inbound 80/443 for the website and 22 only from the administrator's IP. Keep 8787 and the database port private.
- Use a stable public IP for DNS, such as an Elastic IP. Public IPv4 is billable.
- Prepare the database schema, extensions, migrations, and application data separately.

From PowerShell on your local machine:

```powershell
ssh -i "C:\path\your-key.pem" ubuntu@EC2_IP
```

Run subsequent commands on EC2 unless stated otherwise:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates xz-utils nginx python3.12-venv
id glowjob || sudo useradd --system --create-home --home-dir /var/lib/glowjob --shell /usr/sbin/nologin glowjob
sudo install -d -o glowjob -g glowjob -m 700 /var/lib/glowjob/.ssh
```

## 2. Configure Deploy Keys and clone

If `sudo -u glowjob ssh -T git@github.com` has already authenticated successfully, reuse that key. On a new instance, generate a key and add **only the public .pub key** to the repository's Settings -> Deploy keys. Leave Allow write access unchecked. Verify GitHub's host fingerprint before accepting the first connection.

```bash
# New instances only: never overwrite an existing key.
sudo -u glowjob ssh-keygen -t ed25519 -C glow-job-ec2 -f /var/lib/glowjob/.ssh/id_ed25519 -N ""
sudo cat /var/lib/glowjob/.ssh/id_ed25519.pub
```

Clone once. If `/opt/glow-job` already contains a checkout, skip cloning and inspect its Git status:

```bash
sudo install -d -o glowjob -g glowjob /opt/glow-job
sudo -u glowjob git clone git@github.com:THN4/glow-job.git /opt/glow-job
cd /opt/glow-job
```

### The data-pipeline submodule

The main repository references `https://github.com/THN4/glow-job-data-pipeline`. If public:

```bash
sudo -u glowjob git submodule update --init --recursive
```

If private, generate a **separate key** because a GitHub Deploy Key grants access to only one repository:

```bash
sudo -u glowjob ssh-keygen -t ed25519 -C glow-job-pipeline-ec2 -f /var/lib/glowjob/.ssh/pipeline_ed25519 -N ""
sudo cat /var/lib/glowjob/.ssh/pipeline_ed25519.pub
```

Add this public key to **THN4/glow-job-data-pipeline -> Settings -> Deploy keys** with read-only access. Edit the SSH config, preserving existing entries:

```bash
sudo -u glowjob nano /var/lib/glowjob/.ssh/config
```

Add:

```sshconfig
Host github-pipeline
    HostName github.com
    User git
    IdentityFile /var/lib/glowjob/.ssh/pipeline_ed25519
    IdentitiesOnly yes
```

```bash
sudo chmod 600 /var/lib/glowjob/.ssh/config
sudo -u glowjob ssh -T git@github-pipeline
# Successful GitHub authentication normally exits with code 1: no shell is provided.
cd /opt/glow-job
sudo -u glowjob git submodule init
sudo -u glowjob git config submodule.data-pipeline.url git@github-pipeline:THN4/glow-job-data-pipeline.git
sudo -u glowjob git submodule update --init --recursive
test -f data-pipeline/src/resume/config.py && echo "data-pipeline ready"
```

Do not run `git submodule sync` after this override: `.gitmodules` still uses HTTPS. Nested private submodules require access to their repositories as well.

## 3. Reuse the existing .env on EC2

Keep `/opt/glow-job/backend/.env`. Do not overwrite it with `.env.example` or move its credentials elsewhere. Neither `install.sh` nor `update.sh` creates or changes its contents. systemd loads this file into the backend process environment, making its AWS credentials available to the SDK.

**Keep the existing AWS_BEARER_TOKEN_BEDROCK value unchanged.** It is already configured in the deployed `.env`; do not copy or replace it.

```bash
cd /opt/glow-job
sudo test -f backend/.env && echo ".env ready"
sudo chown glowjob:glowjob backend/.env
sudo chmod 600 backend/.env
```

If you placed the file at `/opt/glow-job/.env`, first confirm it contains backend settings; the root file may contain Docker Compose settings instead. Only if it is the correct file and `backend/.env` does not exist, copy it without overwriting:

```bash
sudo cp --no-clobber /opt/glow-job/.env /opt/glow-job/backend/.env
sudo chown glowjob:glowjob /opt/glow-job/backend/.env
sudo chmod 600 /opt/glow-job/backend/.env
```

Review deployment-specific settings with `sudo nano /opt/glow-job/backend/.env`. The following lists settings to review; **do not paste placeholders over working values**. Avoid duplicate keys. The example contains `GEMINI_API_KEY` twice; keep one entry.

```dotenv
PUBLIC_BASE_URL=https://glowjob.modnoi.com
CORS_ORIGINS=https://glowjob.modnoi.com
DATA_DIR=/var/lib/glowjob/data
DB_HOST=YOUR_DB_ENDPOINT
DB_PORT=5432
DB_NAME=YOUR_DB_NAME
DB_USER=YOUR_APP_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
RESUME_EXTRACTOR=bedrock_converse
ROADMAP_PROVIDER=bedrock_converse
AWS_DEFAULT_REGION=us-east-1
ROADMAP_AWS_REGION=us-east-1
GEMINI_API_KEY=YOUR_GEMINI_KEY
```

Use models/inference profiles available to your account in the selected Region. Review `BEDROCK_EXTRACTION_MODEL`, `BEDROCK_RAG_MODEL`, and `BEDROCK_ROADMAP_MODEL`. Live RAG still uses Gemini embeddings even when roadmap generation uses Bedrock. For IP-based testing before HTTPS, temporarily use `http://EC2_IP` for the first two URLs.

For RDS, use the actual endpoint, not the Windows SSH tunnel on port 15432. Allow the database Security Group to receive connections from the EC2 Security Group. For PostgreSQL on the same instance, use `127.0.0.1` and restore/migrate separately. This guide does not install or modify the database.

Authorized credentials can remain in the existing backend `.env` without an EC2 role. Your Bedrock bearer token is already configured; keep it as is. Deployments using AWS access keys instead must also supply `AWS_SESSION_TOKEN` for temporary credentials. Do not add another authentication method unnecessarily.

Use one `KEY=value` or `KEY="value"` per line. Do not use `export`, shell commands, or variable references such as `${OTHER_KEY}`; systemd does not expand variables in an EnvironmentFile. Put comments on separate lines starting with `#`; quote values containing spaces or `#`. Renew expired credentials and restart the service. Never expose credentials to the frontend or commit them to Git. Running without a role does not bypass AWS permissions.

For compatibility, the service also reads `/etc/glow-job-credentials.env` if present. Its values override matching keys in `backend/.env`. To use only the backend file, remove `EnvironmentFile=-/etc/glow-job-credentials.env` from the installed unit and inspect older drop-ins with `sudo systemctl cat glow-job`. New installations do not need a separate credentials file.

### Upgrade an existing service unit

After copying/pulling the new deployment files onto EC2, update the unit without changing `.env`:

```bash
sudo install -m 644 /opt/glow-job/deploy/ec2/glow-job.service /etc/systemd/system/glow-job.service
sudo systemctl daemon-reload
sudo systemctl restart glow-job
curl --fail http://127.0.0.1:8787/api/health
```

For later changes to `.env` values alone, run `sudo systemctl restart glow-job`. Use `daemon-reload` only when changing a unit or drop-in.

## 4. Install the backend and Node.js

The deployment files must be in the GitHub commit cloned/pulled onto EC2 before invoking them:

```bash
cd /opt/glow-job
sudo bash deploy/ec2/install.sh
curl --fail http://127.0.0.1:8787/api/health
```

Health checks the process, not database or AI connectivity. If it fails:

```bash
sudo journalctl -u glow-job -n 80 --no-pager
```

Install Node.js 24 LTS system-wide with the script. It downloads the official x64/arm64 Linux binary, verifies SHA256, and extracts it into `/usr/local`. The default is pinned to 24.22.1; review security updates and pass a newer Node 24 version as an argument when updating. Skip installation if Node 24 is already available system-wide:

```bash
sudo bash deploy/ec2/install-node.sh
sudo -u glowjob node --version
sudo -u glowjob npm --version
```

If either command is missing, Node/npm is not on the `glowjob` user's PATH. Installing nvm for `ubuntu` alone is insufficient.

## 5. Configure DNS and Nginx once

At the DNS provider for `modnoi.com`, add an A record: name `glowjob`, value = EC2 public/Elastic IP. Check before changing a name already serving another application. With Cloudflare, start with DNS only. No root-domain DNS changes or new domain purchase are needed.

```bash
cd /opt/glow-job
# First installation only. Back up and edit an existing configuration in place.
sudo install -m 644 deploy/ec2/nginx.conf /etc/nginx/sites-available/glow-job
sudo ln -sfn /etc/nginx/sites-available/glow-job /etc/nginx/sites-enabled/glow-job
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Build and publish the frontend. This example deploys `main`; pass the actual deployment branch if different:

```bash
cd /opt/glow-job
sudo bash deploy/ec2/update.sh main
curl --fail http://glowjob.modnoi.com/api/health
```

The script creates a frontend release and switches the `current` symlink after the build and backend health check pass. Previous hashed assets are retained for browser tabs already open. This does not guarantee zero downtime or backend rollback: the backend uses a single checkout and virtualenv.

## 6. Enable HTTPS

Proceed after DNS resolves correctly and port 80 reaches EC2:

```bash
# Use the Certbot snap if Certbot has not been installed another way.
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d glowjob.modnoi.com
sudo /snap/bin/certbot renew --dry-run
curl --fail https://glowjob.modnoi.com/api/health
```

Use an existing Certbot installation rather than installing a second one. Set `PUBLIC_BASE_URL` and `CORS_ORIGINS` to HTTPS as in section 3, then run `sudo systemctl restart glow-job`. Do not overwrite the installed Nginx configuration with the HTTP template after Certbot adds TLS.

Test the website, nested-route refreshes, synthetic CV uploads, extraction, profiles, database operations, and roadmaps. Live AI calls incur charges.

## 7. Continue development and update EC2

Locally, test, commit, and push the deployment branch. If changing `data-pipeline`, push that repository first, then commit its updated submodule pointer in `glow-job`. Never commit secrets.

On EC2:

```bash
cd /opt/glow-job
sudo bash deploy/ec2/update.sh main
curl --fail https://glowjob.modnoi.com/api/health
```

The script fetches and fast-forwards only, refusing tracked edits or local-only commits. It updates submodules, runs `npm ci` and the build with `VITE_API_BASE_URL=/api`, installs backend dependencies, restarts the backend, and checks process health before switching the frontend. A `flock` lock prevents overlapping deployments.

If deployment stops, resolve the error rather than resetting the checkout to overwrite work. Review, back up, and migrate database changes separately; migrations are not automatic. If the service unit changes, install it and run `daemon-reload` as in `install.sh`. The update script does not overwrite Nginx or service units.

If deployment files were just added or changed on GitHub, pull them before invoking the updated script:

```bash
cd /opt/glow-job
sudo -u glowjob git pull --ff-only origin main
```

## Gemini vectors for job recommendations

Jobs for you defaults to **Highest knowledge similarity**. It reads existing
`gemini-embedding-2` vectors (768 dimensions) from PostgreSQL; it does not call
Gemini, send profile data to Google, or rebuild embeddings on each request.

The database must already have pipeline migrations `010`, `011`, and `013`,
active knowledge sources, skill-to-chunk mappings, and populated Gemini vectors.
As the database owner/admin in the application's database, replace
`YOUR_DB_USER` with the actual `DB_USER` and grant read access:

```sql
GRANT USAGE ON SCHEMA knowledge TO "YOUR_DB_USER";
GRANT SELECT ON TABLE knowledge.knowledge_sources,
    knowledge.knowledge_chunks, knowledge.knowledge_chunk_skills
TO "YOUR_DB_USER";
```

Verify existing vector coverage without exposing credentials:

```sql
SELECT count(DISTINCT m.skill_id) AS skills_with_gemini_vectors
FROM knowledge.knowledge_chunk_skills m
JOIN knowledge.knowledge_chunks c USING (chunk_id)
JOIN knowledge.knowledge_sources s USING (source_id)
WHERE s.is_active AND c.embedding_model = 'gemini-embedding-2'
  AND c.embedding IS NOT NULL AND vector_norm(c.embedding) > 0;
```

Each skill is represented by the average of its active document vectors. For
each required/preferred posting skill, matching takes the best cosine similarity
to a documented confirmed profile skill, then averages those similarities with
required skills weighted twice as much as preferred skills. This ranks related
knowledge, not proficiency or skill equivalence. See the
[pgvector aggregate and cosine documentation](https://github.com/pgvector/pgvector#querying).

All scored posting skills must have usable vectors for a knowledge similarity
score. A posting with incomplete vectors is eligible only through confirmed
skill overlap and follows scored vector results in the default sort. Undocumented
profile skills still count toward exact coverage. Positive vector similarity is
used for exploration; no relevance cutoff has been calibrated. Shared or broad
documents can make different skills look similar. **Skill coverage** still uses
exact confirmed skill IDs and is displayed separately. Users can select coverage
or newest-posting sorting instead. Missing database permissions remain errors;
they do not silently disable vector matching.

Deploy with the normal update command after pushing this change, then hard-refresh
the browser. The update script preserves the existing `.env`, including
`AWS_BEARER_TOKEN_BEDROCK`. No new API key or IAM role is needed for these database
vector reads.

## Limitations and recovery

- Jobs/caches are in memory. Use one worker; restarting loses job state.
- `DATA_DIR` stores fallback profiles. Temporary uploads use the service's temp directory.
- Back up the database and `/var/lib/glowjob/data` separately. This deployment does not add authentication or rate limiting.
- Frontend releases are in `/var/www/glow-job/releases`. Review contents and disk usage before removing old releases. You can switch `current` to an earlier release after checking API compatibility.
- If backend health fails, the frontend does not switch, but the backend is not rolled back automatically. Revert the code locally through Git and deploy a corrective commit. Database changes need a separate recovery plan.
- Automatic deployment on push is not configured. GitHub Actions needs a separate SSH key for accessing EC2, distinct from the Deploy Key EC2 uses to read GitHub. Restrict deployment branches and permissions.

References: [GitHub Deploy Keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys), [Ubuntu TLS/Certbot](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/), [Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).
