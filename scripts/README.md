# Operations and Regression Script Catalog

## Step 700 Slice 740 Operations Scripts

- `scripts/backup.sh`: creates UTC timestamped compressed Mongo backup (`backups/ks-backup-*.archive.gz`) and prunes artifacts older than 30 days.
- `scripts/restore.sh`: restores a backup archive with explicit confirmation (or `--force`).
- `scripts/health-check.sh`: validates core services (`mongo`, `app`, `nginx`), API health endpoint, and disk threshold.
- `scripts/test-step-740.sh`: deterministic packet validation runner used locally and in CI.

Quick run:

```bash
./scripts/test-step-740.sh
```

## Step 800 Slice 810 Regression Lanes

- `./scripts/regression/backend-regression.sh`
  - Enforces deterministic seed (`PYTHONHASHSEED=0`, `TEST_RANDOM_SEED=800`)
  - Runs backend tests with coverage gate `--cov-fail-under=85`
- `./scripts/regression/frontend-regression.sh`
  - Installs frontend deps and runs Vitest with configured thresholds
- `./scripts/regression/integration-smoke.sh`
  - Runs backend integration marker lane (`-m integration`) with deterministic seed
- `./scripts/test-step-810.sh`
  - Packet runner that executes all three lanes above in order

Operational validation helpers:

- `./scripts/regression/post-deploy-smoke.sh` (`BASE_URL` defaults to `http://localhost`)
- `./scripts/regression/rollback-validation.sh`

## Step 800 Slice 820 Security Lanes

- `./scripts/regression/security-tests.sh`
- `./scripts/regression/authz-regression.sh`
- `./scripts/regression/dependency-audit.sh`
- `./scripts/test-step-820.sh`

## Step 800 Slice 830 Resilience / Recovery Lanes

- `./scripts/regression/resilience-tests.sh`
  - Deterministic backend failure/race subset (`TEST_RANDOM_SEED=830`)
- `./scripts/regression/frontend-error-ux.sh`
  - Frontend API failure/error/retry UX lane
- `./scripts/regression/recovery-smoke.sh`
  - Focused backend recovery smoke checks for outage/guarded recovery paths
- `./scripts/test-step-830.sh`
  - Packet runner executing all three slice-830 lanes

## Step 800 Slice 840 Documentation / Runbook Lanes

- `./scripts/regression/docs-lint.sh`
- `./scripts/regression/docs-link-check.sh`
- `./scripts/regression/docs-quickstart-verify.sh`
- `./scripts/test-step-840.sh`

## Step 800 Slice 850 Launch Readiness / Rollback Gates

- `./scripts/regression/release-regression.sh`
  - Aggregates release-blocking regression/documentation lanes (810/830/840 scope)
- `./scripts/regression/release-security-gates.sh`
  - Aggregates security lanes (820 scope)
- `./scripts/regression/release-smoke.sh`
  - Boots compose stack and requires 3 consecutive post-deploy smoke checks
- `./scripts/regression/rollback-drill.sh`
  - Executes timed rollback validation and fails if `RollbackSeconds > 600`
- `./scripts/test-step-850.sh`
  - Full slice 850 packet runner
