# Spec vs Implementation Divergence Notes

This table captures known intentional divergence between planning/spec docs and current repository behavior.

| Area | Spec / expectation | Current implementation | Status / action |
|---|---|---|---|
| Root project quickstart docs | Root README should provide fresh-clone setup and verification path | README was absent before slice 840; guidance was fragmented across slice docs/scripts | **Resolved in slice 840** via new root `README.md` |
| TLS automation | Production path expects TLS issuance/renewal flow | `certbot` compose service exists as placeholder profile only; no automated issuance job yet | Deferred to launch hardening follow-up (slice 850 risk register if still open) |
| Edge runtime topology | Operator docs expected reconciled runbook for actual compose service graph | No canonical runbook existed pre-840 | **Resolved in slice 840** via `docs/runbooks/deployment-runbook.md` |
| Docs quality CI gates | Slice packet requires docs lint/link/quickstart checks as merge blockers when docs/ops change | Pre-840 CI only gated code/security/resilience lanes | **Resolved in slice 840** by adding `docs-lint`, `docs-link-check`, `docs-quickstart-verify` jobs |
