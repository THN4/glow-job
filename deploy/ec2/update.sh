#!/usr/bin/env bash
# Run as root. Optional branch argument; default main. Uses a dedicated checkout.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash deploy/ec2/update.sh [branch]' >&2; exit 1; }
APP=/opt/glow-job
WEB=/var/www/glow-job
BRANCH=${1:-main}
exec 9>/run/lock/glow-job-deploy.lock
flock -n 9 || { echo 'Another deploy is running.' >&2; exit 1; }
cd "$APP"
as_app() { runuser -u glowjob -- "$@"; }
test -f backend/.env
test -x backend/.venv/bin/python
as_app node --version
as_app npm --version
as_app git check-ref-format --branch "$BRANCH" >/dev/null
CURRENT_BRANCH=$(as_app git branch --show-current)
[[ $CURRENT_BRANCH == "$BRANCH" ]] || { echo "Checkout is on $CURRENT_BRANCH; switch to $BRANCH explicitly first." >&2; exit 1; }
as_app git diff --quiet
as_app git diff --cached --quiet
as_app git fetch origin "$BRANCH"
# Refuse local-only commits instead of silently deploying unpushed server edits.
as_app git merge-base --is-ancestor HEAD FETCH_HEAD
as_app git merge --ff-only FETCH_HEAD
# The submodule URL override in the README is stored in .git/config.
# Do not run submodule sync here: that would replace the SSH override with HTTPS.
as_app git submodule update --init --recursive
test -f data-pipeline/src/resume/config.py
cd "$APP/frontend"
as_app npm ci
as_app env VITE_API_BASE_URL=/api npm run build
test -f dist/index.html
cd "$APP"
as_app backend/.venv/bin/python -m pip install -r backend/requirements.txt
REVISION=$(as_app git rev-parse --short HEAD)
RELEASE="$WEB/releases/$(date -u +%Y%m%dT%H%M%SZ)-$REVISION-$$"
install -d -m 755 "$WEB/releases" "$RELEASE"
cp -a frontend/dist/. "$RELEASE/"
# Retain old hashed assets so already-open browser sessions can lazy-load them.
if [[ -d "$WEB/current/assets" ]]; then
    install -d -m 755 "$RELEASE/assets"
    cp -an "$WEB/current/assets/." "$RELEASE/assets/"
fi
chmod -R a+rX "$RELEASE"
# Check installed Nginx (including TLS) without overwriting it.
nginx -t
systemctl restart glow-job
HEALTHY=false
for attempt in {1..30}; do
    if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then
        HEALTHY=true
        break
    fi
    sleep 2
done
[[ $HEALTHY == true ]] || { echo 'Backend health failed; frontend has not switched. Inspect journalctl -u glow-job.' >&2; exit 1; }
if [[ -e "$WEB/current" && ! -L "$WEB/current" ]]; then
    echo "$WEB/current must be a symlink; inspect the existing directory before proceeding." >&2
    exit 1
fi
ln -s "$RELEASE" "$WEB/current.next-$$"
mv -Tf "$WEB/current.next-$$" "$WEB/current"
printf 'Deployed %s. Test the public website, DB and AI flows separately.\n' "$REVISION"
