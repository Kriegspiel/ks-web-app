# Step 700 Slice 740 Operations Scripts

- `scripts/backup.sh`: creates UTC timestamped compressed Mongo backup (`backups/ks-backup-*.archive.gz`) and prunes artifacts older than 30 days.
- `scripts/restore.sh`: restores a backup archive with explicit confirmation (or `--force`).
- `scripts/health-check.sh`: validates core services (`mongo`, `app`, `nginx`), API health endpoint, and disk threshold.
- `scripts/test-step-740.sh`: deterministic packet validation runner used locally and in CI.

## Quick run

```bash
./scripts/test-step-740.sh
```

## Step 800 Slice 810 Regression Lanes

Canonical command wrappers for regression hardening:

- `./scripts/regression/backend-regression.sh`
  - Enforces deterministic seed (`PYTHONHASHSEED=0`, `TEST_RANDOM_SEED=800`)
  - Runs backend tests with coverage gate `--cov-fail-under=85`
- `./scripts/regression/frontend-regression.sh`
  - Installs frontend deps and runs Vitest with coverage thresholds enforced in `frontend/vitest.config.js`
- `./scripts/regression/integration-smoke.sh`
  - Runs backend integration marker lane (`-m integration`) with deterministic seed
- `./scripts/test-step-810.sh`
  - Packet runner that executes all three lanes above in order

Operational validation helpers:

- `./scripts/regression/post-deploy-smoke.sh` (`BASE_URL` defaults to `http://localhost`)
- `./scripts/regression/rollback-validation.sh`
