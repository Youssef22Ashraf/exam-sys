# AGENTS.md — conventions for the Workplace Assessment & Examination Platform

Canonical convention doc for this repo. Read this before touching any code;
the full spec and rationale live in [tech_readme_files/plan.md](tech_readme_files/plan.md).

## What this is

A web exam + proctoring platform. A candidate registers (name, company ID,
email), sits a timed 40-question exam in two parts (Part A Interface
Management, Part B Stakeholder Management) under webcam recording and
tab-switch auditing, and gets an instant pass/fail. Supervisors use `/admin`
to watch live sessions, review answer sheets and recordings, edit the
question bank and settings, clear the 48-hour retest lockout, and export
CSV. Every finished attempt emails the supervisor list.

## Architecture

Two npm packages in one repo, one process in production.

```
backend/                     Express 4 + TypeScript + Prisma 5 + Socket.io
├── prisma/schema.prisma     Candidate · Question · ExamAttempt · ExamSetting · AdminUser · ExamSession (all indexed)
├── prisma/seed.ts           40 questions + admin users (ADMIN_INITIAL_PASSWORD) + default settings
└── src/
    ├── index.ts             app + http server + Socket.io + static SPA + /api/* mounts
    ├── config/db.ts         the ONE PrismaClient (globalThis-cached)
    ├── config/defaultQuestions.ts   used by POST /api/questions/reset
    ├── middleware/auth.ts   authenticateAdmin — Bearer JWT → req.user;
    │                        optionalAdmin — sets req.user if a token is present, never rejects
    ├── routes/              one router per resource, mounted in index.ts
    └── services/
        ├── scoring.ts       pure (questions, answers, passMark) -> ScoreResult
        ├── examSession.ts   server-owned sitting: clock, warning count, derived proctoring status
        ├── cooldown.ts      shared by check-cooldown and submit
        ├── proctorFiles.ts  deleteRecordings() — unlink a .webm when its row goes
        ├── validation.ts    email format + parseJsonColumn (never bare JSON.parse)
        ├── candidateIdentity.ts   shared by candidateRoutes and examRoutes
        └── emailService.ts  nodemailer; recipients = ExamSetting.notifyEmail || ADMIN_ALERT_EMAIL

frontend/                    React 19 + Vite + TypeScript, no router lib, no state lib
└── src/
    ├── App.tsx              page state machine: home → registration → instructions → exam → results;
    │                        /admin (pathname, #admin hash, or Ctrl+Shift+A) → admin-login | admin-dashboard
    │                        (both admin pages are React.lazy chunks; an exam in
    │                        progress is restored from sessionStorage on mount)
    ├── components/ErrorBoundary.tsx   wraps the app; a render throw must not blank the page
    ├── pages/               one component + one .css per screen
    ├── components/CameraProctor.tsx   getUserMedia + MediaRecorder + snapshot canvas
    └── services/
        ├── api.ts           fetch wrapper; reads fall back to ExamStorage, submit/start throw
        ├── storage.ts       localStorage schema, INITIAL_QUESTIONS, cooldown check, CSV export
        ├── socket.ts        socket.io-client singleton, candidate:* emits, admin:* listeners
        ├── camera.ts        releaseCamera() — stop every track, always
        └── videoStorage.ts  IndexedDB chunk buffer; chunks are written as they record, not at submit
```

Production: the Dockerfile builds `frontend/dist`, copies it beside the
backend, and `backend/src/index.ts` serves it with an SPA fallback for every
path not under `/api`, `/uploads`, or `/socket.io`. One port (5000).

## Data flow

- **Exam**: `App` loads settings + questions from the API on mount and
  mirrors them into localStorage. `Exam.tsx` reads from `ExamStorage`, so
  the exam runs from the local copy — which no longer carries `correctAnswer`,
  so the client cannot score at all. `Exam.tsx` opens a sitting with
  `POST /api/exam/start` on mount and holds the id in `sessionStorage` so a
  refresh rejoins it. `POST /api/exam/submit` requires that id and scores from
  the DB questions.
- **Sockets**: a socket presenting a valid admin JWT in `handshake.auth.token`
  joins the `admins` room; `admin:*` events go to that room only. Candidates
  connect without a token and can emit but not listen in.
- **Proctoring**: `CameraProctor` records the whole session to IndexedDB,
  uploads the `.webm` via `POST /api/proctor/upload-video` (multer) on
  finish, and a snapshot via `upload-snapshot`. Tab blur/focus emits
  `candidate:warning`, which the server banks on the sitting as
  `serverWarnings`; the recorded `tabSwitches` is `max(client, server)`.
  `proctoringStatus` is derived server-side — `Camera Disabled` with no
  recording, else `Verified` at zero warnings and `Warnings` above. Socket
  events `candidate:started|warning|submitted` are rebroadcast to admins as
  `admin:*` with a server timestamp.
- **Lockout**: `GET /api/candidates/check-cooldown?email&companyId` finds
  the newest `ExamAttempt` matching either field and returns
  `eligible:false` inside 48 h of `submittedAt`. The client also checks
  localStorage. Admin `POST /candidates/:id/clear-cooldown` resets it.
- **Settings**: single row `ExamSetting` id `default-settings`. Frontend
  never hardcodes duration or pass mark — always `ExamStorage.getSettings()`.

## Rules

- **Server scores, server decides.** Pass/fail, percentage, attempt number,
  elapsed time and `proctoringStatus` come from `examRoutes.ts` via
  `services/scoring.ts` and `services/examSession.ts`. The client displays; it
  does not compute anything that lands in the DB, and it no longer holds
  `correctAnswer` to compute with. `tabSwitches` from the body can only raise
  the server's own count, never lower it (ADR 008).
- **One PrismaClient.** Import `prisma` from `config/db.ts`. Never `new
  PrismaClient()` outside it (seed.ts is the exception).
- **Auth on every mutation, and on every read of candidate data.** Any
  `POST/PUT/DELETE` takes `authenticateAdmin`, except the candidate-facing
  writes: `candidates/register`, `exam/start`, `exam/submit`, `proctor/upload-*`
  (the uploads require an open `ExamSession` instead). Destructive routes
  additionally take `requireRole("SUPERADMIN")`: `questions/reset`,
  `DELETE candidates/:id`, `DELETE exam/results/:id`. Recordings and snapshots
  are served only by authenticated routes — there is deliberately no static
  `/uploads` mount.
- **JSON columns are strings.** `Question.options` and `ExamAttempt.answers`
  are `JSON.stringify`'d. Parse at the route boundary, never in the page.
- **Offline fallback is deliberate — for reads only.** `api.ts` catches
  network errors on reads and serves `ExamStorage`. Keep that shape when
  adding a read: try network, on failure return local, never throw to a page.
  **`submitExam` and `startExam` are the exceptions** — they throw
  `SubmitFailedError` and the page shows it. A submit that does not reach the
  server must never become a local pass (ADR 008).
- **The exam clock is a deadline, never a countdown.** `Exam.tsx` persists an
  absolute `deadline`; a remaining-seconds counter hands back the time a
  reload or a throttled background tab consumed. The server enforces it
  independently (ADR 008).
- **Admin mutations are server-first.** Call the API, await it, and only then
  touch `ExamStorage` — and surface a refusal. Never apply an admin change
  locally and fire the request with `.catch(() => {})`; a 401 or 403 then
  looks like success until the next sync.
- **Camera release is not optional.** Every path that leaves the exam
  screen (submit, timer expiry, close, admin hotkey, results back) calls
  `releaseCamera()`. A regression here means a candidate's webcam light
  stays on.
- **Question bank is triplicated** (seed, defaultQuestions, storage
  INITIAL_QUESTIONS). Change wording in all three or none. **Only the two
  backend copies carry `correctAnswer`** — never add answers back to
  `INITIAL_QUESTIONS`, they would ship in the candidate's bundle (ADR 008).
  See `CLAUDE.md`.
- **Icons are `<Icon name="…" />` from `components/Icon.tsx`**, inline SVG
  on `currentColor`. No emoji in JSX, strings, or docs. A new glyph is a
  new path in that file, not a library.
- **Persistent state lives in two places** and both must be on a mounted
  volume in production: `backend/prisma/dev.db` (Prisma resolves a relative
  `DATABASE_URL` against the schema directory, *not* cwd) and
  `backend/uploads/`. The server logs both resolved paths at boot — check them
  against the deploy's mounts. `docker-compose.yml` uses different container
  paths because `backend/Dockerfile` sets a different `WORKDIR`.
- **No credentials in tracked files.** No password, JWT secret or SMTP
  password as a literal in code, README, or compose. `config/env.ts` refuses
  to boot production on a secret published in this repo, and the client has no
  offline credential check — the server is the only authority.
- **No new dependencies** without a line in `CHANGELOG.md` saying why.
  The stack is intentionally small: no router, no state library, no ORM
  helpers, no UI kit.

## Naming

| Item | Convention |
| --- | --- |
| Files (backend) | `camelCase.ts`, routers end in `Routes.ts` |
| Files (frontend) | `PascalCase.tsx` for components/pages, `camelCase.ts` for services |
| CSS | one `Name.css` next to `Name.tsx`; class names `kebab-case` |
| API paths | `/api/<plural-resource>`; admin auth ones mounted under the same prefix |
| Socket events | `candidate:<verb>` from client, `admin:<noun>` to admins |
| Env vars | `SCREAMING_SNAKE`, documented in `backend/.env.example` |

## Commands

```bash
# backend
cd backend && npm install && npx prisma db push && npm run seed && npm run dev   # :5000
# frontend
cd frontend && npm install && npm run dev                                       # :5173, proxies nothing — api.ts targets :5000 directly
# quality gate (no tests yet)
cd backend && npx tsc --noEmit
cd frontend && npx tsc -b        # lint has 42 pre-existing errors, see TODO.md §Lint
# production image
docker build -t exam-sys . && docker run -p 5000:5000 --env-file backend/.env exam-sys
```

## Where to look first

- Full spec: [tech_readme_files/plan.md](tech_readme_files/plan.md). Working checklist: [tech_readme_files/TODO.md](tech_readme_files/TODO.md).
- What is actually verified vs. assumed: [tech_readme_files/CURRENT_STATUS.md](tech_readme_files/CURRENT_STATUS.md).
- Deploy + env vars: [README.md](README.md) §Environment Variables, §Production Deployment.
- History and why: [CHANGELOG.md](CHANGELOG.md). ADRs: [tech_readme_files/decisions/](tech_readme_files/decisions/README.md).
- Full navigation: [tech_readme_files/INDEX.md](tech_readme_files/INDEX.md).
