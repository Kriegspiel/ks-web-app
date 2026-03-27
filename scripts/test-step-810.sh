#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/regression/backend-regression.sh"
"$ROOT_DIR/scripts/regression/frontend-regression.sh"
"$ROOT_DIR/scripts/regression/integration-smoke.sh"
