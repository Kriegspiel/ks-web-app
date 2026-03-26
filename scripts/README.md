# Step 700 Slice 740 Operations Scripts

- `scripts/backup.sh`: creates UTC timestamped compressed Mongo backup (`backups/ks-backup-*.archive.gz`) and prunes artifacts older than 30 days.
- `scripts/restore.sh`: restores a backup archive with explicit confirmation (or `--force`).
- `scripts/health-check.sh`: validates core services (`mongo`, `app`, `nginx`), API health endpoint, and disk threshold.
- `scripts/test-step-740.sh`: deterministic packet validation runner used locally and in CI.

## Quick run

```bash
./scripts/test-step-740.sh
```
