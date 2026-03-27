#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

python3 - <<"PY"
from pathlib import Path
import sys

root = Path(".")
md_files = [p for p in root.rglob("*.md") if ".git" not in p.parts and "node_modules" not in p.parts and ".venv" not in p.parts and "venv" not in p.parts]
errors = []

for p in sorted(md_files):
    text = p.read_text(encoding="utf-8")
    if "\t" in text:
        errors.append(f"{p}: contains tab characters")
    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        if line.rstrip() != line:
            errors.append(f"{p}:{i}: trailing whitespace")
    if text and not text.endswith("\n"):
        errors.append(f"{p}: missing trailing newline")

if errors:
    print("docs-lint failed", file=sys.stderr)
    for e in errors:
        print(f"- {e}", file=sys.stderr)
    sys.exit(1)

print(f"docs-lint passed for {len(md_files)} markdown files")
PY
