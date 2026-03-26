#!/usr/bin/env bash
set -euo pipefail

DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
HEALTH_URL="${HEALTH_URL:-http://localhost:18080/api/health}"

usage() {
  cat <<USAGE
Usage: $0 [--disk-warn-pct N] [--health-url URL]

Checks:
  - required container status
  - API health endpoint
  - local disk usage threshold
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --disk-warn-pct)
      DISK_WARN_PCT="$2"
      shift 2
      ;;
    --health-url)
      HEALTH_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if ! [[ "$DISK_WARN_PCT" =~ ^[0-9]+$ ]]; then
  echo "DISK_WARN_PCT must be an integer" >&2
  exit 64
fi

require_running() {
  local service="$1"
  local status
  status="$(docker compose ps --status running --services | grep -x "$service" || true)"
  if [[ -z "$status" ]]; then
    echo "Service not running: $service" >&2
    return 1
  fi
  echo "Service running: $service"
}

require_running mongo
require_running app
require_running nginx

curl -fsS "$HEALTH_URL" >/dev/null
echo "API health OK: $HEALTH_URL"

DISK_USED="$(df -P . | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [[ "$DISK_USED" -ge "$DISK_WARN_PCT" ]]; then
  echo "Disk usage ${DISK_USED}% exceeds threshold ${DISK_WARN_PCT}%" >&2
  exit 1
fi

echo "Disk usage OK: ${DISK_USED}% < ${DISK_WARN_PCT}%"
echo "Health check passed"
