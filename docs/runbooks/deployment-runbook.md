# ks-web-app deployment runbook

## Runtime
- Repo path: `/home/fil/dev/kriegspiel/ks-web-app`
- Service: `ks-web-app-frontend.service`
- App server port: `127.0.0.1:4173`
- Public hostname: `https://app.kriegspiel.org`
- The production app server is `frontend/server.mjs`; it serves `dist/`,
  proxies same-origin `/api/...` traffic to `ks-backend`, redirects
  Cloudflare-forwarded HTTP requests to HTTPS, and sends HSTS.

## Deploy
```bash
cd /home/fil/dev/kriegspiel/ks-web-app
git pull --ff-only
cd frontend
npm ci
npm run build
sudo systemctl restart ks-web-app-frontend.service
```

## Verify
```bash
curl -I https://app.kriegspiel.org/
curl -I http://app.kriegspiel.org/
curl -fsS https://app.kriegspiel.org/ >/dev/null
```
