#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

chmod +x scripts/backup.sh scripts/restore.sh scripts/health-check.sh

echo "[740] shellcheck"
docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable \
  scripts/backup.sh scripts/restore.sh scripts/health-check.sh

echo "[740] help checks"
./scripts/backup.sh --help >/dev/null
./scripts/restore.sh --help >/dev/null
./scripts/health-check.sh --help >/dev/null

echo "[740] ensure stack running"
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
docker compose up -d mongo app frontend nginx

echo "[740] backup"
./scripts/backup.sh
LATEST_BACKUP="$(find backups -type f -name "ks-backup-*.archive.gz" | sort | tail -n 1)"
if [[ -z "$LATEST_BACKUP" || ! -s "$LATEST_BACKUP" ]]; then
  echo "No valid backup artifact found" >&2
  exit 1
fi

echo "[740] restore"
./scripts/restore.sh "$LATEST_BACKUP" --force

echo "[740] health"
./scripts/health-check.sh

echo "[740] all checks passed"
