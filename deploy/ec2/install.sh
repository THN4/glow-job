#!/usr/bin/env bash
# Backend setup on Ubuntu 24.04, after cloning and configuring backend/.env.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash deploy/ec2/install.sh' >&2; exit 1; }
APP=/opt/glow-job
test -f "$APP/backend/app/main.py"
test -f "$APP/data-pipeline/src/resume/config.py"
test -f "$APP/backend/.env" || { echo 'Existing .env not found at /opt/glow-job/backend/.env. Place your configured file there; this script never creates or overwrites it.' >&2; exit 1; }
apt-get update
apt-get install -y python3.12-venv nginx curl ca-certificates util-linux
if ! id glowjob >/dev/null 2>&1; then
    useradd --system --create-home --home-dir /var/lib/glowjob --shell /usr/sbin/nologin glowjob
fi
install -d -o glowjob -g glowjob -m 700 /var/lib/glowjob/data
# This dedicated checkout is owned by the deployment user, including .git.
chown -R glowjob:glowjob "$APP"
chmod 600 "$APP/backend/.env"
if [[ ! -x "$APP/backend/.venv/bin/python" ]]; then
    runuser -u glowjob -- python3.12 -m venv "$APP/backend/.venv"
fi
runuser -u glowjob -- "$APP/backend/.venv/bin/python" -m pip install -r "$APP/backend/requirements.txt"
install -m 644 "$APP/deploy/ec2/glow-job.service" /etc/systemd/system/glow-job.service
systemctl daemon-reload
systemctl enable glow-job
systemctl restart glow-job
for attempt in {1..30}; do
    if curl --fail --silent http://127.0.0.1:8787/api/health; then
        printf '\nBackend is responding. Deploy the frontend next.\n'
        exit 0
    fi
    sleep 2
done
echo 'Backend failed its process health check. Run: sudo journalctl -u glow-job -n 80 --no-pager' >&2
exit 1
