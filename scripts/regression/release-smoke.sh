#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up -d mongo mongo-init frontend app nginx

for i in 1 2 3; do
  PASS=0
  for attempt in 1 2 3 4 5; do
    if BASE_URL="${BASE_URL:-http://localhost:18080}" "$ROOT_DIR/scripts/regression/post-deploy-smoke.sh"; then
      PASS=1
      break
    fi
    sleep 2
  done
  if [ "$PASS" -ne 1 ]; then
    echo "smoke_check_${i}=FAIL" >&2
    exit 1
  fi
  echo "smoke_check_${i}=PASS"
done
