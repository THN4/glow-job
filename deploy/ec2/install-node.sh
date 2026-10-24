#!/usr/bin/env bash
# Install the official Node.js binary system-wide for the service/deploy user.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash deploy/ec2/install-node.sh' >&2; exit 1; }
NODE_VERSION=${1:-24.22.1}
[[ $NODE_VERSION =~ ^24\.[0-9]+\.[0-9]+$ ]] || { echo 'Supply a Node 24 LTS version, e.g. 24.22.1.' >&2; exit 1; }
case "$(uname -m)" in
    x86_64) NODE_ARCH=x64 ;;
    aarch64) NODE_ARCH=arm64 ;;
    *) echo 'Unsupported architecture.' >&2; exit 1 ;;
esac
command -v curl >/dev/null
command -v xz >/dev/null
NODE_CACHE="/var/cache/glow-job/node/$NODE_VERSION-$NODE_ARCH"
install -d -m 755 "$NODE_CACHE"
cd "$NODE_CACHE"
NODE_ARCHIVE="node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
NODE_BASE="https://nodejs.org/dist/v$NODE_VERSION"
curl --fail --show-error --location --proto '=https' --tlsv1.2 "$NODE_BASE/$NODE_ARCHIVE" -o "$NODE_ARCHIVE"
curl --fail --show-error --location --proto '=https' --tlsv1.2 "$NODE_BASE/SHASUMS256.txt" -o SHASUMS256.txt
awk -v archive="$NODE_ARCHIVE" '$2 == archive {print}' SHASUMS256.txt > CHECKSUM
test -s CHECKSUM
sha256sum --check CHECKSUM
tar -xJf "$NODE_ARCHIVE" -C /usr/local --strip-components=1 --no-same-owner
runuser -u glowjob -- node --version
runuser -u glowjob -- npm --version
