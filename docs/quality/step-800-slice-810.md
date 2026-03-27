# Step 800 Slice 810 - Regression Gate Hardening

## Canonical Regression Lanes

- Backend regression: `./scripts/regression/backend-regression.sh`
- Frontend regression: `./scripts/regression/frontend-regression.sh`
- Integration smoke: `./scripts/regression/integration-smoke.sh`
- Packet runner: `./scripts/test-step-810.sh`

All backend/integration lanes enforce deterministic seed defaults:

- `PYTHONHASHSEED=0`
- `TEST_RANDOM_SEED=800`

Mongo-backed integration lane now auto-provisions a temporary MongoDB on `localhost:27018` when not available.

## Coverage Gates

- Backend coverage hard fail: `--cov-fail-under=85`
- Frontend coverage hard fail via Vitest thresholds:
  - lines >= 80
  - functions >= 80
  - branches >= 75
  - statements >= 80

## Required CI Merge Gates

Configured in `.github/workflows/ci.yml` as required-check job names:

- `lint`
- `backend-regression`
- `frontend-regression`
- `integration-smoke`

## Regression Matrix (Current Evidence)

| Area | Status | Evidence |
|---|---|---|
| Auth (register/login/logout/session) | PASS | `.evidence/step800-slice810-backend-regression.log`, `.evidence/step800-slice810-integration-smoke.log` |
| Lobby (create/join/list) | PASS | `.evidence/step800-slice810-frontend-regression.log`, `.evidence/step800-slice810-backend-regression.log` |
| Gameplay (legal/illegal/turn/completion) | PASS | `.evidence/step800-slice810-backend-regression.log`, `.evidence/step800-slice810-frontend-regression.log` |
| Review (transcript/pagination/navigation) | PASS | `.evidence/step800-slice810-frontend-regression.log` |
| Infra-adjacent (`/api/health`, startup, static path) | PASS | `.evidence/step800-slice810-post-deploy-smoke.log`, `.evidence/step800-slice810-packet-run.log` |

No waivers required for this slice.
