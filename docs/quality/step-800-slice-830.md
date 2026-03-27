# Step 800 Slice 830 - Failure and Recovery Behavior Certification

## Canonical Lanes

- Resilience tests: `./scripts/regression/resilience-tests.sh`
- Frontend error UX: `./scripts/regression/frontend-error-ux.sh`
- Recovery smoke: `./scripts/regression/recovery-smoke.sh`
- Packet runner: `./scripts/test-step-830.sh`

Deterministic seed defaults enforced in backend lanes:

- `PYTHONHASHSEED=0`
- `TEST_RANDOM_SEED=830`

## Required CI Merge Gates

Configured in `.github/workflows/ci.yml`:

- `resilience-tests`
- `frontend-error-ux`
- `recovery-smoke`

## Acceptance Mapping

| Acceptance Criterion | Coverage | Evidence |
|---|---|---|
| Controlled failure responses (no unhandled exceptions) | health outage/recovery test + race/guard paths in resilience suite | `.evidence/step800-slice830-resilience-tests.log`, `.evidence/step800-slice830-recovery-smoke.log` |
| Game state consistency preserved after failures | deterministic race/update guard tests (`join/move/resign`) | `.evidence/step800-slice830-resilience-tests.log`, `.evidence/step800-slice830-recovery-smoke.log` |
| Frontend graceful API failure UX with recovery | Lobby/API/App/Join/Settings error-path tests incl. transient retry recovery | `.evidence/step800-slice830-frontend-error-ux.log` |
| Recovery validation returns healthy behavior | packet runner + post-deploy smoke + rollback validation | `.evidence/step800-slice830-packet-run.log`, `.evidence/step800-slice830-post-deploy-smoke.log`, `.evidence/step800-slice830-rollback-validation.log` |

## Regression Matrix

| Scenario | Status | Evidence |
|---|---|---|
| DB outage degrades health and recovers after dependency return | PASS | `.evidence/step800-slice830-resilience-tests.log` |
| Simultaneous/race update paths return guarded deterministic errors | PASS | `.evidence/step800-slice830-resilience-tests.log` |
| Duplicate completion/update boundary guarded (no corruption) | PASS | `.evidence/step800-slice830-recovery-smoke.log` |
| Invalid session/auth under failure load remains bounded (`401`) | PASS (existing auth coverage retained in resilience lane dependencies) | `.evidence/step800-slice830-resilience-tests.log` |
| Frontend failure rendering + retry recovery without crash | PASS | `.evidence/step800-slice830-frontend-error-ux.log` |

## Notes / Risks

- Local runner uses Node `18.20.4`, so frontend lane prints `EBADENGINE` warnings for packages requiring Node `>=20`; tests still pass.
- CI lane uses Node `20` and remains the source of truth for merge gating.
