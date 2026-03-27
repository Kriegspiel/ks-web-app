#!/usr/bin/env bash
set -euo pipefail

export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

"$ROOT_DIR/regression/docs-lint.sh"
"$ROOT_DIR/regression/docs-link-check.sh"
"$ROOT_DIR/regression/docs-quickstart-verify.sh"

cd "$REPO_DIR"
docker compose up -d mongo mongo-init frontend app nginx

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

BASE_URL="http://localhost:18080" "$ROOT_DIR/regression/post-deploy-smoke.sh"
"$ROOT_DIR/regression/rollback-validation.sh"
