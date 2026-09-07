# ADR 003 — One container, one port: Express serves the built SPA

## Status
Accepted (2026-09-06)

## Context
Railway charges per service and the client wants one URL. Two containers
(nginx for the SPA, Node for the API) needed CORS, two domains, and two
sets of env vars. Socket.io also needs to be same-origin to avoid
cookie/CORS pain.

## Decision
The root `Dockerfile` builds `frontend/dist` in one stage and copies it
into the backend image. `backend/src/index.ts` mounts it with
`express.static` and an SPA fallback for every path not under `/api`,
`/uploads`, or `/socket.io`. `api.ts` resolves `API_BASE` to
`window.location.origin + /api` whenever the host is not localhost.
`docker-compose.yml` still describes the two-container local layout for
people who want it.

## Consequences
- One env var set, one domain, one volume mount.
- Frontend and backend deploy together — no independent frontend deploy.
- Static assets are served by Node, not a CDN. Fine at this scale.
