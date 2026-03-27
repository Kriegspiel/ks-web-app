#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_DIR="$ROOT_DIR/backend/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_PYTHON" -m pip install --disable-pip-version-check pip-audit >/dev/null

cd "$ROOT_DIR/frontend"
npm audit --audit-level=high

cd "$ROOT_DIR/backend/src"
"$VENV_PYTHON" -m pip_audit --strict -r app/requirements.txt --ignore-vuln CVE-2026-30922
