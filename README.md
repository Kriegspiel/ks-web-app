# ks-web-app

Frontend repository for `app.kriegspiel.org`.

## Scope
- React + Vite client under `frontend/`
- Frontend-only regression scripts under `scripts/regression/`
- Deployment notes for the app frontend under `docs/runbooks/`

Backend/API code now lives in the separate `ks-backend` repository.

## Local development
```bash
cd frontend
npm ci
npm run dev
```

## Test and build
```bash
./scripts/regression/frontend-regression.sh
./scripts/regression/frontend-error-ux.sh
cd frontend && npm run build
```
