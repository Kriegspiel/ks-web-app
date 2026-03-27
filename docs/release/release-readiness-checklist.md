# Release Readiness Checklist (Step 800 alignment)

Use this artifact during release candidate validation. Every required gate must be green.

## Required CI gates

- [ ] `lint`
- [ ] `backend-regression`
- [ ] `frontend-regression`
- [ ] `integration-smoke`
- [ ] `security-tests`
- [ ] `authz-regression`
- [ ] `dependency-audit`
- [ ] `ops-scripts-quality`
- [ ] `resilience-tests`
- [ ] `frontend-error-ux`
- [ ] `recovery-smoke`
- [ ] `docs-lint`
- [ ] `docs-link-check`
- [ ] `docs-quickstart-verify`

## Required evidence artifacts

- [ ] Step 810 regression evidence (`docs/quality/step-800-slice-810.md` + `.evidence/*810*`)
- [ ] Step 820 security evidence (`docs/quality/step-800-slice-820.md` + `.evidence/*820*`)
- [ ] Step 830 resilience/recovery evidence (`docs/quality/step-800-slice-830.md` + `.evidence/*830*`)
- [ ] Step 840 docs/runbook evidence (`docs/quality/step-800-slice-840.md` + `.evidence/*840*`)

## Ops/runbook verification

- [ ] Deployment runbook executed (`docs/runbooks/deployment-runbook.md`)
- [ ] Post-deploy smoke passed
- [ ] Backup script exercised
- [ ] Restore path validated on test artifact
- [ ] Rollback validation executed

## Signoff

- Release candidate: ____________________
- Date/time (UTC): _____________________
- Operator: _____________________________
- Decision: [ ] GO  [ ] NO-GO
- Notes / residual risks:
  - ____________________________________
  - ____________________________________
