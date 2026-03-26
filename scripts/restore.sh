#!/usr/bin/env bash
set -euo pipefail

MONGO_SERVICE="${MONGO_SERVICE:-mongo}"
MONGO_URI="${MONGO_URI:-mongodb://mongo:27017/kriegspiel?replicaSet=rs0}"
FORCE=0

usage() {
  cat <<USAGE
Usage: $0 <backup-file> [--force]

Restore a compressed Mongo archive into the configured database.
Prompts for confirmation unless --force is provided.

Environment overrides:
  MONGO_SERVICE, MONGO_URI
USAGE
}

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 64
fi

BACKUP_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --force)
      FORCE=1
      shift
      ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$1"
        shift
      else
        echo "Unexpected extra argument: $1" >&2
        usage >&2
        exit 64
      fi
      ;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "backup-file is required" >&2
  usage >&2
  exit 64
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file does not exist: $BACKUP_FILE" >&2
  exit 66
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Backup file is empty: $BACKUP_FILE" >&2
  exit 65
fi

if [[ $FORCE -ne 1 ]]; then
  read -r -p "Restore will overwrite database data. Type RESTORE to continue: " CONFIRM
  if [[ "$CONFIRM" != "RESTORE" ]]; then
    echo "Restore canceled."
    exit 1
  fi
fi

echo "Restoring from $BACKUP_FILE"
docker compose exec -T "$MONGO_SERVICE" mongorestore \
  --uri="$MONGO_URI" \
  --archive \
  --gzip \
  --drop < "$BACKUP_FILE"

echo "Restore complete"
