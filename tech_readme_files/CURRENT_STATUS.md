# Current status

> Synthesized from [`TODO.md`](TODO.md) and [`../CHANGELOG.md`](../CHANGELOG.md)
> on 2026-09-07. Those two are the source of truth — update them first;
> this file is a snapshot, re-derive it if it drifts.

**Version**: `1.0.0` in root `package.json`, HEAD `8f29a52` on `main`.
No git tag yet.

## Phases — 7 of 8 built

| Phase | What | Status |
| --- | --- | --- |
| 0 | Foundations, timer, first UI | ✅ Done |
| 1 | Results, admin dashboard, camera | ✅ Done |
| 2 | Backend API, Prisma, email | ✅ Done |
| 3 | Refresh protection, anti-copy, live sockets | ✅ Done |
| 4 | Video upload/review, Docker | ✅ Done |
| 5 | Hidden `/admin`, dynamic pass mark, camera release | ✅ Done |
| 6 | Single-container Railway deploy | ✅ Done |
| 7 | 48-hour lockout, multi-attempt | ✅ Done |
| 8 | Hardening: auth on reads, tests, cooldown at submit | ⬜ Open |

## What is verified

Verified means: the commit that landed it was built and walked by hand
in a browser against the local backend. Nothing below has been driven by
an automated test, because none exist.

- Full candidate flow, register → results, with webcam on.
- Server-side scoring matches the client preview.
- Video appears in admin after submit and streams with seek.
- Second registration inside 48 h is refused with a countdown.
- Pass-mark change in admin is reflected on the next result screen.
- `docker build` at repo root succeeds; the image serves the SPA and API
  on one port.

## What is not verified

- **Railway in production.** The Dockerfile and `railway.json` are
  written to the README's steps; no deploy log or live URL is recorded
  in this repo. Treat "deployed" as unconfirmed until one is.
- **SMTP delivery.** The transport and templates exist and the test
  button works locally only when real credentials are in `backend/.env`.
  No production mailbox has been confirmed receiving.
- **Persistent volume behaviour.** Nobody has redeployed on Railway and
  checked that `uploads/videos/` and `dev.db` survived.
- **Any browser other than Chromium.** MediaRecorder `.webm` and the
  IndexedDB chunk buffer are untested on Safari and Firefox.

## The gaps that matter before real candidates sit this

Listed in priority order; all are `TODO.md` Phase 8.

1. **Results are public.** Every read endpoint that returns a candidate's
   name, email, company ID, score, or webcam video takes no token. Anyone
   with the domain can pull the CSV. This is the single change that must
   land before the URL is shared.
2. **Lockout is bypassable.** `POST /api/exam/submit` does not check the
   48-hour window; only the registration screen does.
3. **`CORS_ORIGIN` is decorative.** The env var is read and ignored;
   `origin: "*"` is applied for HTTP and sockets.
4. **No tests, no CI.** A regression in scoring or camera release would
   only be caught by a human.

## Quality gate

```bash
cd backend && npx tsc --noEmit
cd frontend && npm run lint && npx tsc -b
```

Run before calling any task done — see [`../CLAUDE.md`](../CLAUDE.md).
As of `8f29a52`: **not run in this environment** — `node_modules` is not
installed in either package. The last evidence of a clean build is the
2026-09-06 deploy commit (`830e246`), which produced the Docker image.
Run the gate after `npm install` and replace this line with the result.

## Deliberately descoped (not bugs)

- Mobile layout — desktop with webcam is the only target (§1).
- Multiple exams or question pools — one fixed 40-question bank (§2.1).
- Offline result sync — the localStorage fallback lets a candidate finish
  if the API is down, but that local result is never uploaded later.
- Candidate accounts / SSO — identity is email + company ID at registration.
