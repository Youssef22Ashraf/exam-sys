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
├── prisma/schema.prisma     Candidate · Question · ExamAttempt · ExamSetting · AdminUser
├── prisma/seed.ts           40 questions + admin/admin123 + default settings
└── src/
    ├── index.ts             app + http server + Socket.io + static SPA + /api/* mounts
    ├── config/db.ts         the ONE PrismaClient (globalThis-cached)
    ├── config/defaultQuestions.ts   used by POST /api/questions/reset
    ├── middleware/auth.ts   authenticateAdmin — Bearer JWT → req.user
    ├── routes/              one router per resource, mounted in index.ts
    └── services/emailService.ts     nodemailer; recipients = ExamSetting.notifyEmail || ADMIN_ALERT_EMAIL

frontend/                    React 19 + Vite + TypeScript, no router lib, no state lib
└── src/
    ├── App.tsx              page state machine: home → registration → instructions → exam → results;
    │                        /admin (pathname, #admin hash, or Ctrl+Shift+A) → admin-login | admin-dashboard
    ├── pages/               one component + one .css per screen
    ├── components/CameraProctor.tsx   getUserMedia + MediaRecorder + snapshot canvas
    └── services/
        ├── api.ts           fetch wrapper; every call falls back to ExamStorage on network failure
        ├── storage.ts       localStorage schema, INITIAL_QUESTIONS, cooldown check, CSV export
        ├── socket.ts        socket.io-client singleton, candidate:* emits, admin:* listeners
        ├── camera.ts        releaseCamera() — stop every track, always
        └── videoStorage.ts  IndexedDB chunk buffer for the recording before upload
```

Production: the Dockerfile builds `frontend/dist`, copies it beside the
backend, and `backend/src/index.ts` serves it with an SPA fallback for every
path not under `/api`, `/uploads`, or `/socket.io`. One port (5000).

## Data flow

- **Exam**: `App` loads settings + questions from the API on mount and
  mirrors them into localStorage. `Exam.tsx` reads from `ExamStorage`, so
  the exam runs from the local copy. `POST /api/exam/submit` re-scores on
  the server from the DB questions — the client score is never trusted.
- **Proctoring**: `CameraProctor` records the whole session to IndexedDB,
  uploads the `.webm` via `POST /api/proctor/upload-video` (multer) on
  finish, and a snapshot via `upload-snapshot`. Tab blur/focus increments
  `tabSwitches`; `proctoringStatus` is `Verified` when zero, `Warnings`
  otherwise. Socket events `candidate:started|warning|submitted` are
  rebroadcast to admins as `admin:*` with a server timestamp.
- **Lockout**: `GET /api/candidates/check-cooldown?email&companyId` finds
  the newest `ExamAttempt` matching either field and returns
  `eligible:false` inside 48 h of `submittedAt`. The client also checks
  localStorage. Admin `POST /candidates/:id/clear-cooldown` resets it.
- **Settings**: single row `ExamSetting` id `default-settings`. Frontend
  never hardcodes duration or pass mark — always `ExamStorage.getSettings()`.

## Rules

- **Server scores, server decides.** Pass/fail, percentage, attempt number
  come from `examRoutes.ts`. The client displays; it does not compute
  anything that lands in the DB.
- **One PrismaClient.** Import `prisma` from `config/db.ts`. Never `new
  PrismaClient()` outside it (seed.ts is the exception).
- **Auth on every mutation.** Any `POST/PUT/DELETE` that changes DB state
  takes `authenticateAdmin`, except the three candidate-facing writes:
  `candidates/register`, `exam/submit`, `proctor/upload-*`. Read endpoints
  that expose candidate PII are currently public — a known gap, see
  `tech_readme_files/TODO.md` §Security. Do not add more.
- **JSON columns are strings.** `Question.options` and `ExamAttempt.answers`
  are `JSON.stringify`'d. Parse at the route boundary, never in the page.
- **Offline fallback is deliberate.** `api.ts` catches every network error
  and serves `ExamStorage`. Keep that shape when adding a call: try
  network, on failure return local, never throw to a page.
- **Camera release is not optional.** Every path that leaves the exam
  screen (submit, timer expiry, close, admin hotkey, results back) calls
  `releaseCamera()`. A regression here means a candidate's webcam light
  stays on.
- **Question bank is triplicated** (seed, defaultQuestions, storage
  INITIAL_QUESTIONS). Change all three or none. See `CLAUDE.md`.
- **Icons are `<Icon name="…" />` from `components/Icon.tsx`**, inline SVG
  on `currentColor`. No emoji in JSX, strings, or docs. A new glyph is a
  new path in that file, not a library.
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
cd frontend && npx tsc -b        # lint has 43 pre-existing errors, see TODO.md §Lint
# production image
docker build -t exam-sys . && docker run -p 5000:5000 --env-file backend/.env exam-sys
```

## Where to look first

- Full spec: [tech_readme_files/plan.md](tech_readme_files/plan.md). Working checklist: [tech_readme_files/TODO.md](tech_readme_files/TODO.md).
- What is actually verified vs. assumed: [tech_readme_files/CURRENT_STATUS.md](tech_readme_files/CURRENT_STATUS.md).
- Deploy + env vars: [README.md](README.md) §Environment Variables, §Production Deployment.
- History and why: [CHANGELOG.md](CHANGELOG.md). ADRs: [tech_readme_files/decisions/](tech_readme_files/decisions/README.md).
- Full navigation: [tech_readme_files/INDEX.md](tech_readme_files/INDEX.md).
