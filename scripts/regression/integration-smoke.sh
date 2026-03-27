#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend/src"

PYTEST_BIN="$ROOT_DIR/backend/.venv/bin/pytest"
if [ ! -x "$PYTEST_BIN" ]; then
  PYTEST_BIN=pytest
fi

TEMP_MONGO_STARTED=0
if ! python3 - <<PY >/dev/null 2>&1
import socket
s=socket.socket()
s.settimeout(0.5)
try:
    s.connect(("127.0.0.1",27018))
    ok=True
except OSError:
    ok=False
finally:
    s.close()
raise SystemExit(0 if ok else 1)
PY
then
  docker rm -f ks-v2-step800-mongo >/dev/null 2>&1 || true
  docker run -d --name ks-v2-step800-mongo -p 27018:27017 mongo:7 >/dev/null
  TEMP_MONGO_STARTED=1
  for _ in $(seq 1 30); do
    if docker exec ks-v2-step800-mongo mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

cleanup() {
  if [ "$TEMP_MONGO_STARTED" -eq 1 ]; then
    docker rm -f ks-v2-step800-mongo >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

PYTHONHASHSEED="${PYTHONHASHSEED:-0}" \
TEST_RANDOM_SEED="${TEST_RANDOM_SEED:-800}" \
RUN_MONGO_INTEGRATION="${RUN_MONGO_INTEGRATION:-1}" \
MONGO_URI="${MONGO_URI:-mongodb://localhost:27018/kriegspiel_test}" \
"$PYTEST_BIN" tests -q -m integration -rs --maxfail=1
