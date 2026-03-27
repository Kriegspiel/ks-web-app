#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD_FILES = [p for p in ROOT.rglob("*.md") if ".git" not in p.parts and "node_modules" not in p.parts and ".venv" not in p.parts and "venv" not in p.parts]

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")

errors: list[str] = []

for md in sorted(MD_FILES):
    text = md.read_text(encoding="utf-8")
    for match in LINK_RE.finditer(text):
        raw = match.group(1).strip()
        target = raw.split()[0]
        if target.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        if target.startswith("#"):
            continue
        if target.startswith("data:"):
            continue

        rel = target.split("#", 1)[0]
        if rel == "":
            continue

        resolved = (md.parent / rel).resolve()
        try:
            resolved.relative_to(ROOT)
        except ValueError:
            errors.append(f"{md}: link escapes repo root: {target}")
            continue

        if not resolved.exists():
            errors.append(f"{md}: missing link target: {target}")

if errors:
    print("Markdown link check failed:", file=sys.stderr)
    for e in errors:
        print(f"- {e}", file=sys.stderr)
    sys.exit(1)

print(f"Markdown link check passed for {len(MD_FILES)} files")
