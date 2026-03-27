#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_PYTHON="$ROOT_DIR/backend/.venv/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
  echo "backend virtualenv python not found: $VENV_PYTHON" >&2
  exit 1
fi

"$VENV_PYTHON" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_PYTHON" -m pip install --disable-pip-version-check pip-audit >/dev/null

cd "$ROOT_DIR/frontend"
npm audit --audit-level=high

cd "$ROOT_DIR/backend/src"
"$VENV_PYTHON" -m pip_audit --strict -r app/requirements.txt --ignore-vuln CVE-2026-30922
