# Kriegspiel v2

Kriegspiel v2 is the MVP stack for async correspondence play with a FastAPI backend, React frontend, MongoDB, and NGINX reverse proxy/static serving.

## Architecture Snapshot

- `backend/src/app`: FastAPI API, auth/session flows, gameplay logic
- `frontend`: React + Vite client
- `docker-compose.yml`: local stack orchestration (mongo, app, frontend artifact build, nginx)
- `scripts/`: operations scripts and step packet test runners
- `docs/runbooks/deployment-runbook.md`: operator deployment + recovery workflow

## Fresh Clone Quickstart

### Prerequisites

- Docker Engine + Docker Compose plugin
- `curl`
- Python 3.12+ (for backend local-dev test lanes)
- Node 20+ (for frontend local-dev/test lanes)

### Boot the stack

```bash
git clone https://github.com/Kriegspiel/ks-v2.git
cd ks-v2
cp .env.example .env

docker compose up -d --build mongo mongo-init frontend app nginx
```

### Verify health

```bash
curl -fsS http://localhost:18080/api/health
curl -fsS http://localhost:18080/ >/dev/null
```

### Shut down

```bash
docker compose down
```

## Local Development (without full compose stack)

### Backend

```bash
cd backend/src
python3 -m venv ../.venv
../.venv/bin/pip install -r app/requirements-dev.txt

# requires MongoDB reachable at MONGO_URI (defaults to localhost:27017)
../.venv/bin/uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

## Key Docs and Roadmap

- Deployment + recovery runbook: `docs/runbooks/deployment-runbook.md`
- Release readiness checklist: `docs/release/release-readiness-checklist.md`
- Final release evidence bundle: `docs/release/step-800-final-evidence-bundle.md`
- Known spec gaps: `docs/quality/spec-implementation-divergence.md`
- Current roadmap slices: `docs/quality/step-800-slice-810.md` through `docs/quality/step-800-slice-850.md`

## Test and Quality Commands

### Core CI lanes

```bash
./scripts/regression/backend-regression.sh
./scripts/regression/frontend-regression.sh
./scripts/regression/integration-smoke.sh
./scripts/regression/resilience-tests.sh
./scripts/regression/frontend-error-ux.sh
./scripts/regression/recovery-smoke.sh
./scripts/regression/security-tests.sh
./scripts/regression/authz-regression.sh
./scripts/regression/dependency-audit.sh
```

### Slice packet runners

```bash
./scripts/test-step-810.sh
./scripts/test-step-820.sh
./scripts/test-step-830.sh
./scripts/test-step-840.sh
```

### Docs/runbook validation

```bash
./scripts/regression/docs-lint.sh
./scripts/regression/docs-link-check.sh
./scripts/regression/docs-quickstart-verify.sh
```

## Release Checklist Artifact

Use `docs/release/release-readiness-checklist.md` as the canonical artifact for release evidence capture and CI gate mapping.

## Spec/Implementation Divergence

Known divergences are tracked in `docs/quality/spec-implementation-divergence.md` and must stay current with each hardening slice.
