#!/usr/bin/env bash
set -euo pipefail

export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

cp .env.example .env

docker compose config -q

docker compose up -d --build mongo mongo-init frontend app nginx

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl -fsS http://localhost:18080/api/health >/dev/null 2>&1 && curl -fsS http://localhost:18080/ >/dev/null 2>&1; then
    echo "docs quickstart verification passed"
    exit 0
  fi
  sleep 2
done

echo "docs quickstart verification failed: stack did not become healthy within 120s" >&2
exit 1
