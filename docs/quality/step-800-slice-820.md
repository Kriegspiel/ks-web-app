# Step 800 Slice 820 - Security Verification and Abuse-Path Coverage

## Canonical Security Lanes

- Security tests: `./scripts/regression/security-tests.sh`
- Authz regression subset: `./scripts/regression/authz-regression.sh`
- Dependency audit gate: `./scripts/regression/dependency-audit.sh`
- Packet runner: `./scripts/test-step-820.sh`

Deterministic seed defaults enforced:

- `PYTHONHASHSEED=0`
- `TEST_RANDOM_SEED=820`

## CI Merge Gates

Required check job names (security workflow):

- `security-tests`
- `authz-regression`
- `dependency-audit`

## Acceptance Mapping

| Acceptance Criterion | Coverage | Evidence |
|---|---|---|
| Automated/repeatable security-critical checks | Security lane + authz subset + packet runner | `.evidence/step800-slice820-security-tests.log`, `.evidence/step800-slice820-authz-regression.log`, `.evidence/step800-slice820-packet-run.log` |
| No sensitive leakage in API/log paths | log redaction processor + tests; auth/session tests | `.evidence/step800-slice820-security-tests.log` |
| Unauthorized access returns expected statuses | `401/403` security tests + authz regression | `.evidence/step800-slice820-security-tests.log`, `.evidence/step800-slice820-authz-regression.log` |
| Findings triaged/dispositioned | risk notes below | this document |

## Regression Matrix

| Area | Status | Evidence |
|---|---|---|
| Cookie flags (`HttpOnly`, `SameSite`, `Secure` in prod) | PASS | `.evidence/step800-slice820-security-tests.log` |
| Invalid/expired session -> `401` | PASS | `.evidence/step800-slice820-security-tests.log` |
| Non-participant game state/transcript protection | PASS | `.evidence/step800-slice820-security-tests.log`, `.evidence/step800-slice820-authz-regression.log` |
| Hidden-piece leakage absent in active game views | PASS | `.evidence/step800-slice820-security-tests.log` |
| Malformed abuse payload rejected with `4xx` | PASS | `.evidence/step800-slice820-security-tests.log` |
| Error payloads/logs avoid secret/session/token fields | PASS | `.evidence/step800-slice820-security-tests.log` |
| Dependency high/critical audit gate | PASS | `.evidence/step800-slice820-dependency-audit.log` (frontend: no high/critical; backend: 1 explicitly ignored CVE below) |
| Rate-limit at edge proxy | WAIVED (proxy lane unavailable in CI) | mitigated by retained NGINX throttle test script; rerun target at slice 830 preflight |

## Known Accepted Risks

1. **Rate-limit verification is environment-sensitive** (requires edge proxy path wired in test env).
   - Severity: Medium
   - Disposition: Deferred with mitigation (explicit rerun before slice 830 complete)
   - Owner: Platform QA/Infra

2. **Transient pip-audit advisory for `pyasn1`** (`CVE-2026-30922`) inherited via `python-jose` dependency chain.
   - Severity: not classified as high/critical in current policy gate
   - Disposition: temporary ignore in gate (`--ignore-vuln CVE-2026-30922`) pending upstream dependency update
   - Owner: Backend security maintenance

No high/critical open risks accepted for this slice.
