# Changelog

All notable changes to this project are documented here, in [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/) format. Versions follow
`package.json` at the repo root. Dates are commit dates.

## [Unreleased]

### Security

- **Security headers.** `X-Content-Type-Options: nosniff` (uploads are
  user-supplied files served back by an authenticated route),
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (the admin JWT can
  travel in `?token=`, and must not leak in a Referer), plus HSTS in
  production. Deliberately not `helmet`: its CSP is the reason to take that
  dependency and this SPA's inline styles would force it off, leaving four
  headers cheaper to set directly.
- **Public routes are rate-limited.** `register`, `check-cooldown`,
  `exam/start`, `exam/submit` and both uploads were unauthenticated and
  entirely unlimited while doing real database and disk work; 60 per 15
  minutes per IP. Verified: throttled with a `Retry-After`.
- **Request bodies are bounded.** A 50 MB JSON limit applied to every route
  including login, and `answers` is stringified straight into a row — one
  public request could write ~50 MB into SQLite. Now 256 KB globally, 8 MB on
  `exam/submit` alone for the base64 snapshot. Oversized bodies get 413.
- **CSV formula injection.** The export escaped quotes but not a leading `=`,
  `+`, `-` or `@`, and `candidateName` comes from the unauthenticated
  `/register`. Cells are prefixed with an apostrophe. Verified: a candidate
  named `=HYPERLINK(...)` exports as text.
- **`?name=` on the download route** went into `Content-Disposition`
  unvalidated; restricted to a plain basename.


- **The admin password is out of the client bundle.** `api.ts` and
  `AdminLogin.tsx` each carried an offline fallback that compared the typed
  credentials against hardcoded literals and, on a match, minted a fake token
  (`dev_admin_session`) that the dashboard accepted because its only guard was
  a non-empty `adminToken`. The real production password therefore shipped in
  readable JavaScript, and blocking the login request was enough to get in.
  Both fallbacks are deleted; the server is the only authority.
- **No credentials in tracked files.** The committed admin password is gone
  from `config/bootstrap.ts` and `prisma/seed.ts` (which also printed it to
  stdout) in favour of `ADMIN_INITIAL_PASSWORD`; the JWT secret published in
  `README.md` and `docker-compose.yml` is gone from both. `config/env.ts` now
  refuses to boot production on any secret that has appeared in this
  repository — the previous guard rejected only `..._default` while the docs
  told operators to use `..._production_2026_x89`, which sailed through — and
  on any secret under 32 characters, and refuses to boot without
  `ADMIN_INITIAL_PASSWORD` (min 12). Re-seeding no longer resets a password an
  admin has changed. The hardcoded `admin@harbico.com` alert recipient is gone
  from four call sites.
- **Password rotation exists.** `POST /api/admin/password` plus a form in the
  admin settings tab. There was previously no way to change an admin password
  at all. Verified: wrong current password, short new password and missing
  token are each refused; a successful change invalidates the old password.
- **Roles are enforced.** `role` had been signed into the JWT and set on
  `req.user` since the beginning but was never read, so SUPERADMIN and ADMIN
  were identical. A new `requireRole` guards the destructive routes —
  `POST /api/questions/reset`, `DELETE /api/candidates/:id`,
  `DELETE /api/exam/results/:id`. Verified: an ADMIN token gets 403 on all
  three and 200 on ordinary reads.
- **Candidate recordings are no longer public.** `app.use("/uploads",
  express.static(...))` served every webcam snapshot at a guessable public URL
  and was a second, unauthenticated door to the videos the admin-only route
  guarded. The mount is deleted and snapshots move to
  `GET /api/proctor/snapshot/:filename` behind `authenticateAdmin`.
- **Upload hardening.** The snapshot filename came from
  `path.extname(file.originalname)`, so an anonymous caller could store
  `.html` or `.svg` and — via the old static mount — have it served executable
  from this app's own origin; the extension is now derived from the mime type,
  as the video path already did. Both uploads gained a mime `fileFilter` and
  now require an open `ExamSession`, closing anonymous 200 MB writes. The
  free-form `attemptId` that let a caller overwrite another candidate's
  `videoFilename` is removed — it was also dead code, since the upload precedes
  the attempt.
- **Socket.IO is authenticated.** There was no handshake check and `io.emit`
  delivered `admin:candidate_started` / `admin:exam_submitted` — names, emails,
  company IDs — to every connected socket, candidates included. Sockets with a
  valid admin JWT now join an `admins` room and `admin:*` goes only there.
  Verified: with an anonymous, an invalid-token and an admin socket connected,
  a candidate start event reached the admin socket alone.
- **Unauthenticated endpoints no longer leak PII.** `check-cooldown` and
  `register` returned identity-conflict messages quoting the matching record,
  so guessing a company ID returned its holder's real name and email.
  `services/candidateIdentity.ts` now returns a `publicMessage` naming only the
  field the caller entered; the detailed message is kept for admin use.
- **SMTP certificate verification is on.** The transport unconditionally set
  `rejectUnauthorized: false` with an SSLv3 cipher string on every provider,
  exposing the SMTP credentials to interception. Verification is now default;
  `SMTP_INSECURE_TLS=true` is an explicit opt-out. Candidate-supplied values
  are HTML-escaped before reaching a supervisor's inbox, and the no-SMTP mock
  branch no longer prints the full alert body.


- **The answer key no longer reaches candidates.** `GET /api/questions` ran
  with no auth and returned `correctAnswer` for all 40 questions, and
  `INITIAL_QUESTIONS` in `frontend/src/services/storage.ts` shipped the same
  answers inside the candidate's JS bundle — server-side scoring (ADR 001)
  was decorative. A new `optionalAdmin` middleware
  (`backend/src/middleware/auth.ts`) sets `req.user` when a token is present
  and continues when it is not; the route includes `correctAnswer` only for a
  caller holding an admin JWT. `Question.correctAnswer` is now optional in the
  frontend type and all 40 answer literals are gone from the bundle.
  (ADR 008, closes the follow-up ADR 001 deferred.)
- **The server owns the exam clock and the proctoring verdict.**
  `timeSpentSeconds`, `tabSwitches` and `proctoringStatus` were body fields on
  `POST /api/exam/submit`, trusted verbatim — the proctored client reporting
  on its own conduct. A new `ExamSession` model plus `POST /api/exam/start`
  gives the server its own `startedAt`; submit requires the session id,
  derives elapsed time from it, and refuses a submit arriving more than
  `durationMinutes + 5 min` late. The `candidate:warning` socket handler now
  increments `serverWarnings` on the session, and the recorded `tabSwitches`
  is `max(client, serverWarnings)` — the client can raise the count, never
  lower it. `proctoringStatus` is derived, never accepted: no recording means
  `Camera Disabled`. Sessions are bound to one candidate email, are spent on
  submit, and cannot be replayed. Verified live: missing, unknown, mismatched,
  expired and replayed sessions are each refused; a submit claiming
  `tabSwitches: 0, proctoringStatus: "Verified"` with no video was recorded as
  `Camera Disabled`.
- **"Use Simulation" removed from `CameraProctor`.** It set
  `hasPermission = true` with no camera and filed a drawn avatar — stamped
  with the candidate's name and the word "Verified" — as the identity
  snapshot. Declining the camera now states that the attempt is filed as
  `Camera Disabled`.

### Fixed

- **A mid-exam refresh dropped the candidate on the marketing hero.** `page`
  and `userData` were component state, so a reload lost the exam; the answer
  draft survived in `sessionStorage` but was only reachable by re-registering
  with the identical email, which the cooldown check could refuse outright.
  The sitting id now marks an exam in progress and `App` restores it. Verified
  in a browser: reload mid-exam returns to the same question with the answer
  selected and the clock continuing (29:19, not a fresh 30:00).
- **The recording lived in memory until submit**, so a tab crash or an OOM on
  a long session lost all of it. Each chunk is now written to the IndexedDB
  buffer as it arrives and the sequence continues across a reload;
  `stopRecording` assembles from the buffer and falls back to memory.
- **The exam clock could be gamed by reloading.** `timeLeft` was a
  setInterval countdown persisted as remaining seconds, so time spent
  reloading, backgrounded (browsers throttle intervals to about once a minute)
  or offline was free. It is now a wall-clock deadline, recomputed each tick.
- **Seeded demo data rendered as real records.** `getCandidates` and
  `getResults` *wrote* fictional people into localStorage on the first read
  and returned them, so a cold cache showed invented candidates in the admin
  dashboard — and `checkCandidateCooldown` evaluated genuine candidates
  against those fake rows. Both now return empty, and 102 lines of fictional
  data are deleted.
- **Admin deletes never reached the server.** `handleDeleteCandidate` and
  `handleDeleteResult` only touched localStorage, so the record survived on
  the backend and reappeared on the next sync. Every admin mutation is now
  server-first and surfaces a refusal in a banner instead of `.catch(() => {})`.
  Verified: an ADMIN-role delete of a result shows "Insufficient privileges"
  and the row stays in the table.
- **"Camera Disabled" displayed as verified.** The results page and both admin
  views branched only on `"Warnings"`, so any other status rendered as a green
  "Verified & Monitored" — including an attempt the server recorded with no
  camera at all. All three states are now distinct. Verified: an attempt taken
  with the camera blocked shows "NO CAMERA" in the results table.
- **No error boundary anywhere**, so a render throw blanked the page mid-exam.
  `components/ErrorBoundary.tsx` wraps the app.
- **An expired admin token went unnoticed** — every call fell back to the
  localStorage cache, so the dashboard stayed up showing stale data as if it
  were live. A 401 now clears the token and signs the admin out.


- **`trust proxy` was never set**, so behind Railway `req.ip` was the proxy's
  address for every request and the login limiter was a *global* 10-per-15-
  minutes lockout shared by all users.
- **Video streaming could crash the process.** `file.pipe(res)` had no
  `error` listener, and a stream failure after `writeHead` is asynchronous —
  it escaped the surrounding try/catch and became an unhandled `error` event.
  Range parsing used bare `parseInt` with no clamping, so `bytes=abc-` gave
  NaN and `bytes=99999999-` a negative `Content-Length`. Both fixed, suffix
  ranges (`bytes=-500`) now supported, and the read stream is destroyed if the
  client disconnects. Verified across six malformed ranges with the server
  still healthy afterwards.
- **No process-level safety net.** Added `unhandledRejection` and
  `uncaughtException` handlers plus graceful `SIGTERM`/`SIGINT` shutdown —
  with `restartPolicyMaxRetries: 10`, one repeatable crashing request could
  exhaust the restart budget and leave the service down.
- **Deleting a record orphaned its recording forever.** `DELETE` on an attempt
  or a candidate only removed rows, so every `.webm` stayed on the volume
  after the record justifying it was gone. Both now remove the files;
  `services/proctorFiles.ts`. Both also return 404 instead of a Prisma
  P2025-driven 500 for an unknown id.
- **Every `JSON.parse` on a JSON column was unguarded**, so one malformed row
  returned 500 for an entire list endpoint. `parseJsonColumn` degrades that
  record instead.
- **The error handler leaked internals** — raw `err.message` went to the
  client — and answered 500 for an oversized upload because multer's
  `LIMIT_FILE_SIZE` carries no `.status`. Now 413/400 as appropriate, and only
  deliberate 4xx messages are echoed.
- **Both `.dockerignore` files shipped the dev database.** `dev.db` matches
  only a context-root file, so `backend/prisma/dev.db` — real candidate PII
  and admin bcrypt hashes — was copied into the image by
  `COPY backend/prisma ./prisma/`. Now `**/*.db`, plus `**/.env`.
  `backend/.dockerignore` also began with a UTF-8 BOM, so its first line never
  matched and `node_modules` was not actually excluded.
- **README marked the database volume "(Optional)".** Without it every Railway
  redeploy destroys the database. Documented as required, with the correct
  path — Prisma resolves `file:./dev.db` against the schema directory, so the
  file is at `/app/backend/prisma/dev.db`, and `docker-compose.yml` uses
  different paths because `backend/Dockerfile` sets a different `WORKDIR`.


- **Video upload never worked.** `api.uploadVideo` posted to
  `/api/proctor/upload`; the route is `/api/proctor/upload-video`. Every upload
  404'd, the failure was swallowed by the surrounding catch, and the attempt
  was recorded with no recording. Corrected, and rejections are now logged.
- `config/bootstrap.ts` contained invalid UTF-8 bytes in four log strings
  (rendering as `����` and `d~s`); rewritten. Question bootstrap uses one
  `createMany` instead of 40 sequential inserts.
- **Letting the exam clock lapse and reloading granted a fresh 30 minutes.**
  The deadline was only restored from `sessionStorage` if it was still in the
  future, so an expired one fell through to a new full-length deadline. Found
  by the auto-submit test. A lapsed deadline now means the exam is over.
- **Auto-submit could fire before the sitting existed**, producing a request
  the server was always going to refuse with `SESSION_REQUIRED`. It now waits
  for `POST /api/exam/start` to land.
- **Frontend lint is green for the first time**: 43 errors to 0, and 0
  warnings. Roughly two thirds were the swallowed-error pattern removed in
  earlier phases. The rest: `registerCandidate` no longer builds an
  `any`-typed error with an ad-hoc property (a typed `RegistrationRefusedError`
  instead), socket payloads are typed once rather than `any` at seven call
  sites, deliberate best-effort `catch {}` blocks in the camera teardown paths
  say why they are empty, `Date.now()` is no longer called during an admin
  render (the cooldown countdown only refreshed when something unrelated
  re-rendered), and the exam-in-progress restore is a lazy initial state
  rather than a mount effect that immediately calls `setState`. Four
  `set-state-in-effect` exceptions remain, each with its reason.
- Removed the abandoned empty `test/` scaffolding at the repo root; tests live
  in each package.

### Changed

- **The admin portal is a lazy chunk.** Every candidate downloaded the
  2,099-line dashboard and its CSS on first load. `React.lazy` (no router
  library, per ADR 002) moves 43.7 KB of JS and 11 KB of CSS out of the
  candidate bundle: 353 KB to 312 KB, and the main stylesheet 35.7 KB to
  25.9 KB.
- **Submit shows what it is doing.** Stopping the recorder, buffering and
  uploading a 30-minute `.webm` can take tens of seconds, and the screen sat
  frozen with no spinner or progress. A progress view now names the current
  stage and warns against closing the window.
- **The admin dashboard refreshes from the server, not localStorage.**
  `reloadData` re-read the local cache every 2 seconds and re-rendered the
  whole component, while a socket event about a submission on another machine
  fired a toast but never updated the table — that record was not in this
  browser's cache. Socket events and a 30-second safety net now pull from the
  API.
- Candidate details are no longer logged to the console by `App.beginExam`,
  and the two startup syncs no longer swallow errors silently.


- **Indexes.** The schema had no secondary index at all. Added them for the
  columns `services/cooldown.ts` and the admin lists actually filter and order
  on, including `ExamAttempt.candidateId` — an unindexed foreign key on the
  largest table, since Prisma does not create one for a relation on SQLite.
- **`validateCandidateIdentity` no longer loads both tables.** It called
  `findMany()` with no `where` on `Candidate` and `ExamAttempt` and filtered in
  JS — two unbounded table loads per call, on three unauthenticated endpoints.
  Now filtered in SQL.
- The server logs the resolved absolute database and uploads paths at boot, so
  an operator can check them against the configured volume mounts. Container
  `HEALTHCHECK` added to both Dockerfiles and `healthcheckPath` to
  `railway.json`.
- `rateLimit` sweeps expired entries; previously a key was only reclaimed when
  hit again after expiry, so one-shot IPs accumulated for the process lifetime.


- **A failed submit is an error, not a local pass.** `api.submitExam` caught
  every network error, scored the attempt from localStorage and returned a
  result the candidate saw as authoritative — invisible to admin, no email.
  That path is deleted. Failures throw `SubmitFailedError`; a transport
  failure re-arms the submit behind a visible retry banner (the draft is still
  in `sessionStorage`), a deliberate refusal such as a cooldown 403 ends the
  attempt. Supersedes the submit half of ADR 005.
- **The cooldown-refusal screen is reachable.** It was nested inside the
  `!question` branch of `Exam.tsx`, which is false in the normal case, so a
  403 at submit rendered nothing at all — frozen page, camera released, no
  message.
- **Scoring, identity and email validation extracted from route files.**
  `services/scoring.ts` is a pure `(questions, answers, passMark) →
  ScoreResult` with no Prisma and no `req`, so it is testable without an HTTP
  request; `services/candidateIdentity.ts` and `services/validation.ts` end
  `examRoutes.ts` importing from a sibling router. Behaviour unchanged.
  `scoring.ts` and `examSession.ts` each carry a runnable `assert` self-check
  until the Phase 5 test harness lands.
- Candidate names, emails and company IDs are no longer written to stdout by
  the `candidate:started` and `candidate:submitted` socket handlers.

### Added

- **Inline SVG icons replace every emoji in the UI.**
  `components/Icon.tsx` holds 22 glyphs on a 24-grid, `currentColor`,
  sized by `font-size`, no icon-library dependency. 88 emoji and symbol
  glyphs across the admin dashboard, login, exam, results, registration,
  camera panel, and hero were swapped for `<Icon name="…" />`. Emoji
  inside plain strings (toasts, console lines) were removed rather than
  replaced. Icon-only buttons carry `aria-label`.
- **Design tokens for the admin portal.** A token layer at the top of
  `styles.css` (`--bg`, `--surface`, `--text`, `--primary`, semantic
  soft/border pairs, shadows, focus ring). The dark palette and header
  toggle that shipped with it in PR #10 were removed on `dev` the same
  day in favour of a single light corporate theme; `hooks/useTheme.ts`
  now only guarantees the attribute is absent.
- **Admin dashboard UI pass.** Tabs are a sticky segmented control under
  the header; stat cards carry a colour accent and tabular numerals;
  tables get sticky headers, zebra rows, hover highlight, and a 70vh
  scroll region; badges get a status dot and border; inputs get a visible
  focus ring; modals and toasts animate in and respect
  `prefers-reduced-motion`. Every hard-coded colour in
  `AdminDashboard.css`, `AdminDashboard.tsx` (105 inline literals),
  `AdminLogin.tsx`, and `styles.css` is now a token.
- **A test suite and CI, where there were none.** 72 tests: 54 backend
  (vitest + supertest) and 18 frontend (vitest + testing-library + jsdom).
  `.github/workflows/ci.yml` runs both `tsc` gates, lint, both suites and the
  production build on every push and pull request.
  - Backend: `scoreExam` (pass threshold, section split, string indexes from a
    JSON body, empty bank); the 48-hour cooldown boundary with the clock
    frozen across the write and the read, so "exactly 48 hours" is exact;
    `authenticateAdmin` against a missing, malformed, expired and
    foreign-signed token; `optionalAdmin`; `requireRole`.
  - Regression guards for the holes closed on this branch:
    `GET /api/questions` withholds `correctAnswer` from an anonymous caller and
    from a bad token but returns it to an admin; submit refuses a missing,
    unknown, mismatched and replayed session; the server's score overrides a
    client-supplied one; `proctoringStatus` is derived, not trusted;
    `timeSpentSeconds` comes from the server clock; role enforcement on the
    destructive routes; uploads require an open sitting; `/uploads` is not
    served statically; a public identity conflict does not name the matching
    record; CSV formula injection is neutralised.
  - Frontend: `ExamStorage.checkCandidateCooldown` (boundary, email-or-company
    matching, identity conflicts) and that a cold cache returns empty rather
    than inventing records; the exam timer opens a sitting, persists a
    deadline rather than a countdown, resumes a saved deadline, and
    auto-submits once it has passed.
  - Two CI assertions at the artefact level: no `correctAnswer` values in the
    built bundle, and no known credential in a tracked file.
- New dev dependencies, per the AGENTS.md rule: `vitest` in both packages
  (pinned to 2.x in the backend, whose `@types/node` matches its Node 20
  runtime), `supertest` and `@types/supertest`, and `jsdom` plus
  `@testing-library/react`, `/dom` and `/jest-dom`. `npm test` in each package.

### Security

- **Every read that returns candidate data now requires the admin JWT.**
  `GET /api/candidates`, `/candidates/:id/history`, `/exam/results`,
  `/exam/results/:id`, `/exam/export/csv`, `/proctor/video/:filename`,
  `/proctor/download/:filename`, and `POST /settings/test-email` all take
  `authenticateAdmin`. Before this, anyone with the domain could pull every
  candidate's name, email, company ID, score, and webcam recording.
  `authenticateAdmin` also accepts the same JWT as `?token=` because a
  `<video src>` cannot set an `Authorization` header; the admin dashboard
  appends it for playback. `api.ts` sends the bearer header on `test-email`.

- **The 48-hour lockout is enforced at submit.** `POST /api/exam/submit`
  returns `403 COOLDOWN_ACTIVE` when an attempt by the same email or
  company ID exists inside the window. Before this only the registration
  screen checked, so a client that skipped it could submit. The query
  moved to `backend/src/services/cooldown.ts` and `check-cooldown` uses the
  same function, so the two cannot disagree. `api.ts` treats a 403 as a
  refusal and throws instead of falling back to local scoring.

- **`CORS_ORIGIN` is applied** to both Express and Socket.io. Unset means
  `*` (dev); set means a comma-separated list of exact origins, and
  `credentials` is only enabled in that case. Previously the variable was
  read and ignored.
- **Production refuses to boot on the fallback `JWT_SECRET`.**
  `config/env.ts` throws at import when `NODE_ENV=production` and the
  secret is unset or still the dev string that is in git.

- **`POST /api/admin/login` is rate-limited**: 10 attempts per IP per
  15 minutes, then `429` with `Retry-After`. In-memory, single process
  (`middleware/rateLimit.ts`).
- **`videoFilename` and `candidatePhoto` are validated at submit.** The
  filename must be a bare `*.webm` basename; the photo must be an image
  data URL. A crafted body can no longer store a path for the admin UI to
  fetch. The video upload also ignores the client's extension and always
  writes `.webm`.

### Fixed

- **Concurrent submits and question adds no longer collide.** The
  candidate upsert and the attempt insert in `POST /api/exam/submit` run
  in one `prisma.$transaction`, so two simultaneous submits cannot both
  read `totalAttempts = N` and both write `attemptNumber = N + 1`.
  `POST /api/questions` computes `max(id) + 1` and inserts inside one
  transaction for the same reason.
- **`clear-cooldown` no longer rewrites audit timestamps.** It used to
  backdate `lastAttemptAt` and every attempt's `submittedAt` by 49 hours.
  It now stamps a new nullable `Candidate.cooldownClearedAt`, and the
  shared cooldown query treats attempts at or before that stamp as spent.
  Additive schema change; `prisma db push` adds the column without
  touching rows.
- `.dockerignore` no longer excludes `*.md`, so a runtime read of a
  markdown file inside the image cannot silently fail.
- README badge said Prisma 6; `package.json` pins 5.x. Badge corrected.
- `npm run seed` now runs `prisma db seed`, which loads `backend/.env`.
  The old `ts-node prisma/seed.ts` did not, so on a fresh clone it failed
  with `Environment variable not found: DATABASE_URL` while the README
  said it would work.
- `socket.ts` derives the Socket.io origin from `VITE_API_URL` instead of
  hardcoding `localhost:5000`, so a dev backend on another port gets the
  live feed too.

- **The results screen now shows the server's verdict.** `Exam.tsx`
  computed a local result and fired `submitExam` without awaiting it, so
  the candidate saw the browser's score and attempt id while the server
  stored (or refused) something else. It now awaits the response and
  renders the server object; the local calculation is used only when
  `api.ts` falls back because the API is unreachable. A `403
  COOLDOWN_ACTIVE` shows a "Submission refused" screen instead of a
  result.
- The recording was uploaded twice on submit (one fire-and-forget call
  followed by an awaited one). One upload now.

### Added

- Project convention docs: `AGENTS.md`, `CLAUDE.md`, and
  `tech_readme_files/` (`plan.md`, `TODO.md`, `CURRENT_STATUS.md`).

### Known issues (not yet fixed — tracked in `tech_readme_files/TODO.md`)

- Frontend `npm run lint` reports 43 pre-existing errors (unused `err`
  in catch blocks, `any`, empty blocks). It has never been green; the
  documented gate said otherwise until this entry. `tsc -b` is clean.
- The 48-hour lockout is enforced at `check-cooldown` and in the browser,
  but `POST /api/exam/submit` does not re-check it. A candidate who skips
  the registration screen can submit inside the window.
- No automated tests exist for either package.

## [1.0.0] — 2026-09-07

First deployable release. Everything below was built between 2026-09-04
and 2026-09-07.

### Added — examinee flow

- Registration (name, company ID, email) → instructions → timed exam →
  results certificate. Timer auto-submits on expiry. Flagged questions,
  answered-count grid, keyboard-free navigation.
- Instant results: overall percentage, Part A / Part B breakdown, pass/fail
  against the admin-configured threshold, attempt number.
- Exam refresh protection: in-progress answers, elapsed time, and tab-switch
  count survive a reload via localStorage. Copy, cut, paste, and context
  menu are blocked on the exam screen.

### Added — proctoring

- `CameraProctor`: live webcam preview, full-session `MediaRecorder`
  capture buffered in IndexedDB, snapshot on submit. Video uploads to
  `backend/uploads/videos/` via multer; admins stream it back through
  `GET /api/proctor/video/:filename` with range support.
- Tab/window blur auditing. `tabSwitches` is stored on the attempt and
  drives `proctoringStatus` (`Verified` | `Warnings`).
- Live remote proctoring over Socket.io: `candidate:started`,
  `candidate:warning`, `candidate:submitted` are rebroadcast to the admin
  dashboard with server timestamps.
- Camera hardware release: every exit path (submit, timeout, close, admin
  hotkey, results → home) calls `releaseCamera()`. Two follow-up commits
  removed a duplicated dependency block and a syntax error in
  `CameraProctor.tsx` that had kept tracks alive.

### Added — 48-hour lockout and multi-attempt tracking

- `GET /api/candidates/check-cooldown` finds the newest attempt by email
  **or** company ID and returns remaining hours plus the exact reopen time.
  Registration shows a countdown and refuses to proceed.
- `ExamAttempt.attemptNumber`, `Candidate.totalAttempts/highestScore/
  latestScore/lastAttemptAt`. Admin candidate view lists every attempt in
  order.
- Admin `POST /api/candidates/:id/clear-cooldown` for authorised retests.

### Added — admin portal (`/admin`)

- Isolated route: reachable only by URL (`/admin`, `#admin`) or the
  `Ctrl+Shift+A` hotkey. No links from the candidate UI. JWT stored in
  `sessionStorage`; `authenticateAdmin` middleware guards mutations.
- Live session monitor, candidate search (name / ID / email), per-attempt
  answer sheet with candidate-vs-correct comparison, inline video review.
- Question bank CRUD with section filter and a reset-to-defaults action.
  New candidate sessions pick up changes without a restart (the frontend
  refetches on mount).
- Global settings: exam title, duration, passing percentage, sector badge,
  notification recipients. Passing percentage flows through to the exam
  screen and results certificate dynamically (fixed a hardcoded 70%).
- CSV export of all attempts with scores, timestamps, and integrity flags.

### Added — email alerts

- nodemailer SMTP transport. On every submit, an HTML report goes to
  `ExamSetting.notifyEmail` (comma-separated list supported) or
  `ADMIN_ALERT_EMAIL`. Re-attempts get `[RE-ATTEMPT #N]` in the subject and
  an amber banner. Outlook / Office 365 transport options added.
- `POST /api/settings/test-email` and a "Send test" button in admin.

### Added — backend and persistence

- Express + TypeScript + Prisma 5 on SQLite (`DATABASE_URL` swappable to
  Postgres). Five models: `Candidate`, `Question`, `ExamAttempt`,
  `ExamSetting`, `AdminUser`. Seed loads 40 questions and `admin/admin123`.
- Server-side scoring in `POST /api/exam/submit` against DB questions.
- `express.json` limit raised to 50 MB for base64 snapshots.
- Frontend `api.ts` falls back to localStorage on any network failure so the
  exam still runs if the API is down.

### Added — deployment

- Multi-stage root `Dockerfile`: build frontend, build backend, run one
  Node process serving both on port 5000 with an SPA fallback.
  `railway.json` selects it. `docker-compose.yml` for a two-container local
  stack. Persistent volume guidance for `uploads/` and the SQLite file.
- Vite `server.watch.usePolling` for WSL2 file sync.
- README rewritten with architecture diagram, env var table, Railway steps.

### Changed

- Prisma `db push` runs on container start instead of migrations.
- Question wording synchronised across seed, `defaultQuestions.ts`, and
  the frontend `INITIAL_QUESTIONS` (2026-09-06 "question synchronization").

[Unreleased]: https://github.com/Youssef22Ashraf/exam-sys/compare/8f29a52...HEAD
[1.0.0]: https://github.com/Youssef22Ashraf/exam-sys/commits/8f29a52
