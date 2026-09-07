> [INDEX](../INDEX.md) > Guides > Deployment

# 08 — Deployment

## Railway (target)

Steps in [`../../README.md`](../../README.md) §Production Deployment.
Summary: connect the GitHub repo, Railway picks the root `Dockerfile` via
`railway.json`, set env vars, mount volumes at `/app/backend/uploads` and
(SQLite) `/app/backend/prisma`, generate a domain.

**Verify after each deploy** (`CURRENT_STATUS.md` says this has not been
recorded yet): `GET /api/health` returns `frontendServed:true`; a video
uploaded before redeploy still plays after.

## Docker locally

```bash
docker build -t exam-sys .
docker run -p 5000:5000 --env-file backend/.env -v $PWD/backend/uploads:/app/backend/uploads exam-sys
```

`docker compose up` runs the older two-container layout (nginx + node);
it still works but is not what Railway runs.

## What the image does on boot

`npx prisma db push && node dist/index.js`. See
[ADR 007](../decisions/007-prisma-db-push-not-migrate.md) for why and
what it can destroy.

## Rollback

Railway → Deployments → redeploy the previous build. The DB is not
rolled back; if the schema changed destructively there is nothing to
roll back to. Take a copy of `dev.db` from the volume before any schema
change.
