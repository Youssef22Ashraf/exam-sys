# TODO — Workplace Assessment & Examination Platform

Working checklist. Specification lives in [plan.md](plan.md); what is
verified vs. assumed lives in [CURRENT_STATUS.md](CURRENT_STATUS.md).
Section references (§) point at `plan.md`.

**Rules**: one phase at a time, finished completely. A phase is done only
when every box under it is ticked, backend `tsc --noEmit` is clean,
frontend `tsc -b` is clean, `npm run lint` is clean, `npm test` passes in
both packages, and `CHANGELOG.md` is updated.

---

## 0. Blockers — need the client (§5)

- [ ] Confirm results/CSV may go behind admin login (nobody uses the public link)
- [ ] Video retention period and who deletes
- [ ] SQLite-on-volume vs. Postgres for production
- [ ] Retest identity: email OR company ID (current) vs. company ID only
- [ ] Question / option randomisation wanted or not
- [ ] Real SMTP account and recipient list for production
- [ ] Who holds the admin password after the first deploy (the code no longer
      has a default: `ADMIN_INITIAL_PASSWORD` is required in production, and it
      is changed in the portal after first login)

---

## Phase 0 — Foundations ✅ 2026-09-04

- [x] Vite + React 19 + TypeScript frontend
- [x] Exam timer with auto-submit
- [x] Page-state navigation in `App.tsx` (no router lib)
- [x] Styling to match `ref-for ui/` screenshots

## Phase 1 — Results, admin, camera ✅ 2026-09-05

- [x] Results page with Part A / Part B split
- [x] Admin dashboard: candidates, attempts, answer sheet
- [x] `CameraProctor` with live preview and MediaRecorder
- [x] Admin login screen

## Phase 2 — Backend ✅ 2026-09-05

- [x] Express + Prisma + SQLite, five models (§2)
- [x] Seed: 40 questions + admin user + default settings
- [x] JWT `authenticateAdmin` middleware
- [x] Routers: admin, candidates, questions, exam, proctor, settings
- [x] Server-side scoring in `POST /api/exam/submit`
- [x] nodemailer completion email
- [x] `api.ts` with localStorage fallback

## Phase 3 — Integrity ✅ 2026-09-05

- [x] Refresh protection: answers, elapsed time, tab count persisted mid-exam
- [x] Copy / cut / paste / context menu blocked on exam screen
- [x] Socket.io live proctoring: `candidate:*` → `admin:*`

## Phase 4 — Recording and ops ✅ 2026-09-06

- [x] Video upload (multer) + range-streamed playback in admin
- [x] Snapshot upload on submit
- [x] Test-email button + `POST /api/settings/test-email`
- [x] Multiple recipients, Outlook / Office 365 transport
- [x] `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`

## Phase 5 — Admin isolation and settings ✅ 2026-09-06

- [x] `/admin` reachable only by URL, hash, or `Ctrl+Shift+A`; no candidate-side links
- [x] Passing percentage read from settings everywhere (was hardcoded 70)
- [x] Camera tracks released on finish / submit / close (three fix commits)
- [x] Vite polling watch for WSL2

## Phase 6 — Single-container deploy ✅ 2026-09-06

- [x] Root multi-stage `Dockerfile`, backend serves `frontend/dist` with SPA fallback
- [x] `railway.json`
- [x] `API_BASE` auto-resolves to same origin off localhost
- [x] Question wording synchronised across seed / defaults / `INITIAL_QUESTIONS`
- [x] README with env vars, Railway steps, volume guidance

## Phase 7 — Lockout and attempts ✅ 2026-09-06

- [x] `check-cooldown` by email OR company ID, 48 h from `submittedAt`
- [x] Registration countdown with reopen time
- [x] `attemptNumber`, `totalAttempts`, `highestScore`, `latestScore`, `lastAttemptAt`
- [x] Admin attempt history per candidate
- [x] Admin `clear-cooldown`
- [x] `[RE-ATTEMPT #N]` subject + amber banner in email

---

## Phase 8 — Hardening (open)

### Security — do now

- [x] **Strip `correctAnswer` from the public `GET /api/questions`** and from
      `INITIAL_QUESTIONS` in the client bundle — `optionalAdmin` middleware,
      answers returned only to an admin JWT (ADR 008, feat/hardening-1-integrity)
- [x] **Server-owned exam clock and proctoring signal** — `ExamSession` +
      `POST /api/exam/start`; submit derives `timeSpentSeconds`, refuses a late
      submit, takes `tabSwitches = max(client, serverWarnings)` and derives
      `proctoringStatus`. Proven live: missing / unknown / mismatched / expired /
      replayed sessions each refused (ADR 008)
- [x] **Remove "Use Simulation" from `CameraProctor`** — it filed a drawn avatar
      labelled "Verified" as the identity snapshot for a candidate with no camera
- [x] **A failed submit no longer scores locally** — `SubmitFailedError` with a
      visible retry banner; supersedes the submit half of ADR 005 (ADR 008)
- [x] **Purge hardcoded credentials** — offline login fallbacks deleted from
      `api.ts` and `AdminLogin.tsx` (they shipped the real admin password in the
      bundle and minted a fake token); `ADMIN_INITIAL_PASSWORD` replaces the
      literal in `bootstrap.ts`/`seed.ts`; JWT secret removed from `README.md`
      and `docker-compose.yml`; boot guard now rejects every secret published in
      this repo and anything under 32 chars (feat/hardening-2-access)
- [x] **Password rotation** — `POST /api/admin/password` + settings-tab form
- [x] **Role enforcement** — `requireRole("SUPERADMIN")` on `questions/reset`,
      `DELETE candidates/:id`, `DELETE exam/results/:id`. Proven: ADMIN token
      403 on all three, 200 on ordinary reads
- [x] **Remove the public `/uploads` static mount** — candidate webcam snapshots
      were world-readable and it bypassed the admin-only video route; snapshots
      move to `GET /api/proctor/snapshot/:filename` behind `authenticateAdmin`
- [x] **Upload hardening** — snapshot extension from mime type not
      `originalname` (stored-XSS vector), mime `fileFilter` on both uploads,
      both require an open `ExamSession`, attacker-controlled `attemptId` removed
- [x] **Authenticate Socket.IO** — admin JWT in the handshake joins an `admins`
      room; `admin:*` no longer broadcast to every connected client. Proven:
      anonymous and invalid-token sockets receive nothing
- [x] **Stop leaking PII from unauthenticated endpoints** — identity conflicts
      return a `publicMessage` naming only the caller's own field; guessing a
      company ID no longer returns its holder's name and email
- [x] **SMTP certificate verification** — `rejectUnauthorized: false` +
      SSLv3 ciphers removed; `SMTP_INSECURE_TLS` is an explicit opt-out.
      Candidate input HTML-escaped in the mail body
- [x] **Auth on every read that returns candidate data**: `GET /api/candidates`,
      `/candidates/:id/history`, `/exam/results`, `/exam/results/:id`,
      `/exam/export/csv`, `/proctor/video/:filename`, `/proctor/download/:filename`,
      `POST /settings/test-email`. `?token=` accepted for `<video src>`. (fix/auth-on-read-endpoints)
- [x] **Enforce cooldown in `POST /api/exam/submit`** — shared `services/cooldown.ts`,
      403 `COOLDOWN_ACTIVE`. Proven live: 2nd submit same email 403, same company ID 403,
      unrelated 201. (fix/cooldown-at-submit)
- [x] Apply `CORS_ORIGIN` to both `cors()` and the Socket.io `cors.origin`; keep `*` only when unset (fix/cors-and-jwt-boot-guard)
- [x] Refuse to boot in production when `JWT_SECRET` is the fallback string (`config/env.ts`)
- [x] Rate-limit `POST /api/admin/login` — 10 / 15 min / IP, in-memory (fix/login-rate-limit-and-filename-validation)
- [x] Validate `videoFilename` / `candidatePhoto` at submit — `^[\w.-]+\.webm$` and `data:image/…;base64,`

### Operations — do now

- [x] **`app.set("trust proxy", 1)`** — `req.ip` was the proxy address behind
      Railway, making the login limiter a global lockout (feat/hardening-3-ops)
- [x] **Rate-limit the public routes** — register, check-cooldown, exam/start,
      exam/submit, both uploads; 60 / 15 min / IP. Limiter also sweeps expired
      entries instead of growing forever
- [x] **Bound request bodies** — 256 KB globally (was 50 MB on every route,
      including login), 8 MB on `exam/submit` for the base64 snapshot
- [x] **Security headers** — nosniff, DENY, no-referrer, HSTS in production.
      No `helmet`: its CSP would have to be disabled for this SPA
- [x] **Indexes** — the schema had none. `ExamAttempt` candidateId (unindexed
      FK), candidateEmail, companyId, submittedAt; `Candidate` companyId,
      registeredAt, status. Verified created, no rows lost
- [x] **`validateCandidateIdentity` filters in SQL** — was two unbounded
      `findMany()` table loads per unauthenticated request
- [x] **Crash paths** — stream `error` listeners on video pipe, Range parsing
      clamped (416 on garbage, suffix ranges supported), `unhandledRejection` /
      `uncaughtException` / graceful SIGTERM. Proven across six malformed ranges
- [x] **Guard every `JSON.parse` on a JSON column** — one malformed row used to
      500 a whole list endpoint (`parseJsonColumn`)
- [x] **Delete recordings with their records** — deleting an attempt or
      candidate orphaned the `.webm` permanently; both also 404 instead of 500
      on an unknown id
- [x] **`.dockerignore` excludes `**/*.db` and `**/.env`** — `dev.db` matched
      only a context-root file, so `backend/prisma/dev.db` (candidate PII +
      admin hashes) was baked into the image. `backend/.dockerignore` also had
      a UTF-8 BOM, so its first line never matched
- [x] **CSV formula injection** — leading `=`/`+`/`-`/`@` prefixed; proven with
      a candidate named `=HYPERLINK(...)`
- [x] **`?name=` on the download route** restricted to a plain basename
- [x] Container `HEALTHCHECK` + `railway.json` `healthcheckPath`; boot logs the
      resolved absolute database and uploads paths
- [x] README: the database volume was marked "(Optional)" — it is required, and
      the path is `/app/backend/prisma`, not `/app/backend`

### Correctness — do now

- [x] `attemptNumber` upsert + attempt insert in one `prisma.$transaction` (fix/correctness-transactions-and-cooldown-column)
- [x] `POST /api/questions` `max(id)+1` + insert in one transaction — 5 parallel adds → ids 41–45, all 201
- [x] `.dockerignore` no longer excludes `*.md`
- [x] `clear-cooldown` stamps `Candidate.cooldownClearedAt`; attempt `submittedAt` untouched — proven: 403 → clear → 201 attempt #2, attempt #1 timestamp identical
- [x] README badge → Prisma 5.x

### UX and data loss — done

- [x] **Resume a mid-exam refresh** — `page`/`userData` were component state, so
      a reload landed on the marketing hero and the draft was only reachable by
      re-registering (which the cooldown could refuse). Proven in a browser
      (feat/hardening-4-ux)
- [x] **Buffer the recording as it records** — chunks were in memory until
      submit, so a crash lost the whole session
- [x] **Deadline instead of a countdown** — a reload or a throttled background
      tab used to award free time
- [x] **Submit progress** — the screen froze silently while the recorder
      stopped, buffered and uploaded
- [x] **Delete the seed-on-read demo data** — `getCandidates`/`getResults` wrote
      fictional people into localStorage and returned them as real records, and
      the cooldown check compared genuine candidates against them
- [x] **Admin mutations are server-first** — `handleDeleteCandidate` and
      `handleDeleteResult` never called the API at all; the rest used
      `.catch(() => {})`. Refusals now show in a banner. Proven: an ADMIN delete
      of a result shows "Insufficient privileges" and the row stays
- [x] **"Camera Disabled" no longer displays as verified** — the results page
      and both admin views treated anything that was not "Warnings" as clean
- [x] **Error boundary** + 401 handling (an expired token left the dashboard up
      showing cached data as live)
- [x] **Lazy-load the admin portal** — candidates downloaded the 2,099-line
      dashboard; bundle 353 KB to 312 KB
- [x] Dashboard refreshes from the API, not a 2-second localStorage re-read

### Lint — green

- [x] Frontend `npm run lint`: **0 errors, 0 warnings** (was 43 errors). Two
      thirds were the swallowed-error pattern removed in phases 1-4; the rest
      were typed socket payloads, documented best-effort `catch {}` in the
      camera teardown, an impure `Date.now()` in an admin render, and the
      exam restore moved to lazy state. Lint is now part of the gate
      (feat/hardening-5-tests)

### Tests — 72 passing

- [x] Backend: vitest + supertest, 54 tests. Scoring; the 48-hour cooldown
      boundary (clock frozen across write and read so "exactly 48 h" is exact);
      `authenticateAdmin` against missing / malformed / expired /
      foreign-signed tokens; `optionalAdmin`; `requireRole`; plus HTTP-level
      regression guards for every hole closed on this branch
- [x] Frontend: vitest + testing-library, 18 tests.
      `ExamStorage.checkCandidateCooldown`, the cold-cache empty result, and
      the exam timer (opens a sitting, persists a deadline not a countdown,
      resumes it, auto-submits once passed)
- [x] CI: `.github/workflows/ci.yml` runs both `tsc` gates, lint, both suites
      and the production build on push and pull request, plus two artefact
      assertions: no answer key in the built bundle, no known credential in a
      tracked file

### Done outside the plan

- [x] Admin dark theme + UI pass — token layer in `styles.css`, `hooks/useTheme.ts`, admin-scoped `data-theme` (feat/admin-ui-dark-theme)

### Later / nice to have

- [ ] Collapse the triplicated question bank to one source (`defaultQuestions.ts`) that seed and a build step both read
- [ ] Postgres provider + `prisma migrate` instead of `db push` on boot
- [ ] Video retention job (delete `.webm` older than N days, keep the attempt
      row) — **blocked on §0.2**. Deleting a record now removes its file, but
      nothing expires recordings by age
- [ ] Question / option shuffle per attempt, seeded and stored so the answer sheet replays correctly
- [ ] Replace `page` string state with a real router if a third top-level area
      appears (the admin portal is now lazy-loaded; ADR 002's trigger is still unmet)
- [x] Remove `console.log` of candidate data in `App.tsx` `beginExam` and the
      backend socket handlers
