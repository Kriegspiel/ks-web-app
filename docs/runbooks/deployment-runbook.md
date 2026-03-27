# Deployment and Operations Runbook

This runbook is the operator-facing path for provisioning, deploy, smoke checks, backup/restore, and rollback for ks-v2.

## 1) Provisioning Baseline

Required host capabilities:

- Linux host with Docker Engine + Docker Compose plugin
- Open ports: `80` (ingress), optional `443` once TLS profile is wired
- Persistent storage for MongoDB volume (`mongo_data`) and backup artifacts (`./backups`)

Repository prerequisites:

```bash
git clone https://github.com/Kriegspiel/ks-v2.git
cd ks-v2
cp .env.example .env
```

Set at least these `.env` values for non-dev deployment:

- `SECRET_KEY` (strong unique value)
- `ENVIRONMENT=production`
- `SITE_ORIGIN` (public origin)

## 2) Deploy

```bash
docker compose up -d --build mongo mongo-init frontend app nginx
```

Verify running services:

```bash
docker compose ps
```

## 3) Health Checks / Smoke

Use both direct smoke and scripted health checks:

```bash
curl -fsS http://localhost:18080/api/health
curl -fsS http://localhost:18080/ >/dev/null

./scripts/health-check.sh --health-url http://localhost:18080/api/health
BASE_URL=http://localhost:18080 ./scripts/regression/post-deploy-smoke.sh
```

## 4) Backup

Create timestamped compressed archive:

```bash
./scripts/backup.sh --output-dir backups --retention-days 30
```

Expected artifact format:

- `backups/ks-backup-YYYYMMDDTHHMMSSZ.archive.gz`

## 5) Restore

Restore from an existing archive (destructive to target DB contents):

```bash
./scripts/restore.sh backups/ks-backup-<timestamp>.archive.gz --force
```

Follow with smoke checks:

```bash
curl -fsS http://localhost:18080/api/health
curl -fsS http://localhost:18080/ >/dev/null
```

## 6) Troubleshooting

### API health failing

- Check service status: `docker compose ps`
- Inspect logs: `docker compose logs --tail=200 app nginx mongo`
- Validate compose config: `docker compose config -q`

### Mongo unavailable

- Confirm `mongo` container health state
- Confirm replica-init step completed (`mongo-init` exited successfully)
- Re-run deploy command to recover init race

### Frontend unreachable

- Check `frontend` artifact build service completed
- Check `nginx` running and listening on `18080`

## 7) Rollback Procedure

For docs/process regressions, rollback via git revert of the offending release change:

```bash
git revert --no-edit <bad-commit>
```

For runtime verification after rollback:

```bash
./scripts/regression/rollback-validation.sh
```

## 8) Ownership and Review Cadence

- **Engineering owner:** backend/frontend maintainers update README + runbook alongside behavior changes.
- **Ops owner:** release operator validates backup/restore/health instructions once per release candidate.
- **Cadence:** docs + runbook review every release cut (at minimum monthly) and any change to compose topology, scripts, or CI merge gates.
