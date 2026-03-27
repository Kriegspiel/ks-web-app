#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
curl -fsS "$BASE_URL/api/health"
curl -fsS "$BASE_URL/" >/dev/null
