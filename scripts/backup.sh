#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-ks-backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MONGO_SERVICE="${MONGO_SERVICE:-mongo}"
MONGO_URI="${MONGO_URI:-mongodb://mongo:27017/kriegspiel?replicaSet=rs0}"

usage() {
  cat <<USAGE
Usage: $0 [--output-dir DIR] [--retention-days N]

Create a timestamped compressed Mongo archive and prune old backups.

Environment overrides:
  BACKUP_DIR, BACKUP_PREFIX, RETENTION_DAYS, MONGO_SERVICE, MONGO_URI
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --output-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --retention-days)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "RETENTION_DAYS must be an integer" >&2
  exit 64
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/${BACKUP_PREFIX}-${TIMESTAMP}.archive.gz"

echo "Creating backup: $OUT_FILE"
docker compose exec -T "$MONGO_SERVICE" mongodump \
  --uri="$MONGO_URI" \
  --archive \
  --gzip > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "Backup artifact is empty: $OUT_FILE" >&2
  exit 1
fi

echo "Pruning backups older than ${RETENTION_DAYS} days in $BACKUP_DIR"
find "$BACKUP_DIR" -type f -name "${BACKUP_PREFIX}-*.archive.gz" -mtime "+${RETENTION_DAYS}" -print -delete

echo "Backup complete: $OUT_FILE"
