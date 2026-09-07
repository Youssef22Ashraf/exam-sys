# Changelog

All notable changes to this project are documented here, in [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/) format. Versions follow
`package.json` at the repo root. Dates are commit dates.

## [Unreleased]

### Security

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

- **Video upload never worked.** `api.uploadVideo` posted to
  `/api/proctor/upload`; the route is `/api/proctor/upload-video`. Every upload
  404'd, the failure was swallowed by the surrounding catch, and the attempt
  was recorded with no recording. Corrected, and rejections are now logged.
- `config/bootstrap.ts` contained invalid UTF-8 bytes in four log strings
  (rendering as `����` and `d~s`); rewritten. Question bootstrap uses one
  `createMany` instead of 40 sequential inserts.

### Changed

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
