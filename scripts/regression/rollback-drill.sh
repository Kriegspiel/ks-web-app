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

START_TS="$(date +%s)"
docker compose up -d mongo mongo-init frontend app nginx

PASS=0
for attempt in 1 2 3 4 5; do
  if BASE_URL="${BASE_URL:-http://localhost:18080}" "$ROOT_DIR/scripts/regression/post-deploy-smoke.sh"; then
    PASS=1
    break
  fi
  sleep 2
done
if [ "$PASS" -ne 1 ]; then
  echo "rollback_precheck_smoke=FAIL" >&2
  exit 1
fi

echo "rollback_precheck_smoke=PASS"
"$ROOT_DIR/scripts/regression/rollback-validation.sh"
END_TS="$(date +%s)"
ROLLBACK_SECONDS="$((END_TS - START_TS))"
echo "RollbackSeconds=${ROLLBACK_SECONDS}"

if [ "$ROLLBACK_SECONDS" -gt 600 ]; then
  echo "Rollback drill exceeded threshold (600s): ${ROLLBACK_SECONDS}s" >&2
  exit 1
fi
