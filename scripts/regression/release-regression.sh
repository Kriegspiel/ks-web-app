#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/scripts/regression/backend-regression.sh"
"$ROOT_DIR/scripts/regression/frontend-regression.sh"
"$ROOT_DIR/scripts/regression/integration-smoke.sh"
"$ROOT_DIR/scripts/regression/resilience-tests.sh"
"$ROOT_DIR/scripts/regression/frontend-error-ux.sh"
"$ROOT_DIR/scripts/regression/recovery-smoke.sh"
"$ROOT_DIR/scripts/regression/docs-lint.sh"
"$ROOT_DIR/scripts/regression/docs-link-check.sh"
"$ROOT_DIR/scripts/regression/docs-quickstart-verify.sh"
