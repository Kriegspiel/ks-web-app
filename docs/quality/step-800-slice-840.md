# Step 800 Slice 840 - Documentation and Runbook Reconciliation

## Canonical Lanes

- Docs lint: `./scripts/regression/docs-lint.sh`
- Docs link check: `./scripts/regression/docs-link-check.sh`
- Docs quickstart verify: `./scripts/regression/docs-quickstart-verify.sh`
- Packet runner: `./scripts/test-step-840.sh`

## Required CI Merge Gates

Configured in `.github/workflows/ci.yml`:

- `docs-lint`
- `docs-link-check`
- `docs-quickstart-verify`

## Acceptance Mapping

| Acceptance Criterion | Coverage | Evidence |
|---|---|---|
| New developer can run project from README instructions without undocumented steps | Fresh-clone quickstart lane boots compose stack + smoke checks | `.evidence/step800-slice840-docs-quickstart-verify.log`, `.evidence/step800-slice840-packet-run.log` |
| Operator can deploy/recover using docs only | Deployment runbook + scripted health/backup/rollback references reconciled | `docs/runbooks/deployment-runbook.md`, `.evidence/step800-slice840-packet-run.log` |
| Divergences explicit and current | Spec-implementation divergence table maintained | `docs/quality/spec-implementation-divergence.md` |
| Broken docs links/commands fail checks | Docs lint/link/quickstart scripts + CI gates | `.evidence/step800-slice840-docs-lint.log`, `.evidence/step800-slice840-docs-link-check.log`, `.evidence/step800-slice840-docs-quickstart-verify.log` |

## Regression Matrix

| Area | Status | Evidence |
|---|---|---|
| README quickstart path valid | PASS | `.evidence/step800-slice840-docs-quickstart-verify.log` |
| Local dev backend/frontend commands documented | PASS | `README.md` |
| Test command documentation valid | PASS | `README.md`, `scripts/README.md` |
| Deployment runbook path valid | PASS | `docs/runbooks/deployment-runbook.md` |
| Backup/restore/health script references valid | PASS | `docs/runbooks/deployment-runbook.md`, `scripts/README.md` |
| Architecture divergence notes present and accurate | PASS | `docs/quality/spec-implementation-divergence.md` |

## Notes / Risks

- External HTTP link availability can be transient; link check lane enforces all local links and markdown anchors as non-skippable.
- Quickstart verify lane intentionally uses ephemeral compose up/down to catch stale commands.
