#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend/src"

PYTEST_BIN="$ROOT_DIR/backend/.venv/bin/pytest"
if [ ! -x "$PYTEST_BIN" ]; then
  PYTEST_BIN=pytest
fi

PYTHONHASHSEED="${PYTHONHASHSEED:-0}" \
TEST_RANDOM_SEED="${TEST_RANDOM_SEED:-830}" \
"$PYTEST_BIN" tests -q \
  --maxfail=1 \
  --disable-warnings \
  -k "health_recovers or race_conditions_on_updates or lifecycle_service_race"
