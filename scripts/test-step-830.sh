#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/regression/resilience-tests.sh"
"$ROOT_DIR/scripts/regression/frontend-error-ux.sh"
"$ROOT_DIR/scripts/regression/recovery-smoke.sh"
