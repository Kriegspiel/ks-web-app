#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/regression/release-regression.sh"
"$ROOT_DIR/scripts/regression/release-security-gates.sh"
"$ROOT_DIR/scripts/regression/release-smoke.sh"
"$ROOT_DIR/scripts/regression/rollback-drill.sh"
