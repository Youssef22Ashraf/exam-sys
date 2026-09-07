# plan.md — Build brief for the Workplace Assessment & Examination Platform

> **This file is the spec.** It says what the system is, how it is built,
> and what "done" means. `TODO.md` is the checklist against it;
> `CURRENT_STATUS.md` says what is actually verified. No code here by
> design — the code is in `backend/` and `frontend/`; this document
> constrains it.

---

## 0. Agent operating instructions — read before touching anything

**Working directory** — `/Volumes/files/projects/exam-sys`.
Two npm packages, `backend/` and `frontend/`, one root `package.json`
whose scripts build both and start one process.

**Read-only inputs. Never edit.**

| Path | What it is | What to take from it |
| --- | --- | --- |
| `interface questions.txt` | Client's Part A questions, answers marked ✓ | Exact wording and correct option for questions 1–20 and 31–33 |
| `stakeholder questions.txt` | Client's Part B questions | Exact wording for 21–30 and 34–40 |
| `ref-for ui/*.jpeg` | Five WhatsApp screenshots of the target look | Colours, card layout, hierarchy. Authoritative on design. |

**Rules of engagement**

1. **Read before you write.** `AGENTS.md` first, then the route or page you
   are changing, then every caller of it.
2. **Server is the truth.** Scores, pass/fail, attempt numbers, cooldown
   eligibility are computed in `backend/src/routes`. The browser mirrors.
3. **Triplicated question bank.** `seed.ts`, `defaultQuestions.ts`, and
   `storage.ts INITIAL_QUESTIONS` change together or not at all.
4. **Every exit releases the camera.** No exception, no "the browser will
   do it".
5. **Quality gate** before any task is called done: backend `tsc --noEmit`,
   frontend `npm run lint && tsc -b`. There are no tests yet; say so.
6. **Document as you go.** `CHANGELOG.md` and `TODO.md` move in the same
   commit as the code.

---

## 1. What this is

A **certification exam with proctoring** for an engineering & construction
contractor. Before a person is given site or operational access they must
pass a 40-question test on two internal procedures. The exam is sat
unsupervised on a laptop, so the system records the webcam, counts tab
switches, and enforces a 48-hour wait before a retest. Supervisors review
everything from a hidden `/admin` portal and are emailed on every submit.

- **Users**: candidates (anonymous until they register), supervisors
  (seeded admin account).
- **Platform**: desktop browser with a webcam. Mobile is not a target.
- **Out of scope**: multiple exams, per-candidate accounts, SSO, question
  randomisation, LMS integration, PDF certificates.

**Priority when time is short** — Exam screen → Submit + scoring → Camera
recording → Lockout → Admin review → Email → everything else.

---

## 2. Domain

### 2.1 The exam

Forty questions in a fixed order. Part A (Interface Management) is
questions 1–20 plus true/false 31–33; Part B (Stakeholder Management) is
21–30 plus 34–40. Multiple choice has four options, true/false has two;
both are stored as an `options` array with a 0-based `correctAnswer`.
Duration and pass mark are admin settings, default 30 min and 70%.

### 2.2 The attempt

One `ExamAttempt` row per submit. It denormalises candidate name, email,
and company ID so a deleted candidate still leaves an audit trail
(cascade delete removes attempts too — accepted). Stores Part A/B scores,
elapsed seconds, `tabSwitches`, `proctoringStatus`, snapshot, and video
filename. `attemptNumber` increments per candidate.

### 2.3 The lockout

Identity is **email OR company ID**. The newest attempt matching either
starts a 48-hour clock from `submittedAt`. Inside it, registration shows
remaining hours and the reopen timestamp. Admin can clear it; the current
implementation backdates `lastAttemptAt` and the attempts' `submittedAt`
so `check-cooldown` passes (audit-timestamp rewrite — `TODO.md` §Correctness).

### 2.4 Proctoring

Camera on for the whole exam; whole session recorded to IndexedDB then
uploaded as `.webm` on submit. A JPEG snapshot is taken at submit. Tab
blur / visibility change increments `tabSwitches` and emits
`candidate:warning`. `proctoringStatus` is `Verified` at zero switches,
`Warnings` otherwise. `Camera Disabled` exists in the type union but
nothing sets it today.

---

## 3. Architecture

Described in `AGENTS.md` §Architecture. Summary of the constraints:

- **Backend**: Express 4, TypeScript, Prisma 5, SQLite by default, Socket.io
  on the same HTTP server. One `PrismaClient`. Routers per resource.
  `authenticateAdmin` on every admin mutation.
- **Frontend**: React 19 + Vite. No router library — `App.tsx` holds a
  `page` string and switches on it; `/admin` is detected from
  `location.pathname` / hash. No state library — localStorage via
  `ExamStorage` is the client model. Plain CSS files per page.
- **Production**: one container, one port. Backend serves `frontend/dist`
  with SPA fallback. `prisma db push` runs on boot.
- **Offline fallback**: every `api.ts` call catches network failure and
  reads/writes `ExamStorage` instead, so the candidate can finish the exam
  if the API blips. Results written locally are not synced later — this
  is a graceful-degradation path, not offline-first.

---

## 4. API surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/login` | — | username/password → JWT |
| GET | `/api/admin/me` | admin | token check |
| GET | `/api/candidates/check-cooldown` | — | `?email&companyId` → eligibility |
| POST | `/api/candidates/register` | — | upsert candidate |
| GET | `/api/candidates` | — (gap) | list all |
| GET | `/api/candidates/:id/history` | — (gap) | attempts for one |
| DELETE | `/api/candidates/:id` | admin | cascade delete |
| POST | `/api/candidates/:id/clear-cooldown` | admin | reset lockout |
| GET | `/api/questions` | — | bank, options parsed |
| POST/PUT/DELETE | `/api/questions[/:id]` | admin | CRUD |
| POST | `/api/questions/reset` | admin | reload `defaultQuestions.ts` |
| POST | `/api/exam/submit` | — | score + persist + email |
| GET | `/api/exam/results[/:id]` | — (gap) | attempts |
| GET | `/api/exam/export/csv` | — (gap) | CSV |
| DELETE | `/api/exam/results/:id` | admin | remove attempt |
| POST | `/api/proctor/upload-video` | — | multer `.webm` |
| POST | `/api/proctor/upload-snapshot` | — | multer JPEG |
| GET | `/api/proctor/video/:filename` | — (gap) | range stream |
| GET | `/api/proctor/download/:filename` | — (gap) | attachment |
| GET/PUT | `/api/settings` | — / admin | single-row settings |
| POST | `/api/settings/test-email` | — (gap) | send test mail |
| GET | `/api/health` | — | uptime, frontendServed |

"(gap)" marks endpoints that expose data or side effects without a token.
Closing them is `TODO.md` §Security, item 1.

Socket events: client emits `candidate:started`, `candidate:warning`,
`candidate:submitted`; server rebroadcasts as `admin:candidate_started`,
`admin:candidate_warning`, `admin:exam_submitted` with `timestamp`.

---

## 5. Decisions that need the client

1. **Who may read results.** Today anyone with the URL can. Locking every
   read behind admin auth is the obvious fix; confirm nobody relies on the
   public CSV link.
2. **Retention.** Webcam videos accumulate in `uploads/videos/` forever.
   How long must they be kept, and who deletes them?
3. **Database in production.** SQLite on a Railway volume is single-writer
   and survives redeploys only if the volume is mounted at
   `/app/backend/prisma`. Postgres is a one-line `provider` change plus
   `DATABASE_URL`. Decide before real candidates sit the exam.
4. **Retest identity.** Email OR company ID means a typo in either creates
   a fresh identity. Should company ID alone be authoritative?
5. **Question randomisation.** Currently fixed order, fixed option order.
   Wanted or not?

---

## 6. Environment

Documented in `README.md` §Environment Variables and
`backend/.env.example`. Required in production: `JWT_SECRET`,
`DATABASE_URL`, `SMTP_*`, `ADMIN_ALERT_EMAIL`. `CORS_ORIGIN` is read but not
applied (`TODO.md` §Security item 3).

---

## 7. Definition of done — per change

- Backend compiles (`tsc --noEmit`), frontend lints and compiles.
- Manually walked: register → exam → submit → result → admin sees it.
- Camera light goes off on every exit you touched.
- `CHANGELOG.md` entry under Unreleased. `TODO.md` box ticked or added.
- No secrets, DB files, or recordings in the diff.

---

## 8. Phases (as built — see `TODO.md` for the boxes)

| Phase | Scope | Landed |
| --- | --- | --- |
| 0 | Repo, Vite app, timer, first UI | 2026-09-04 |
| 1 | Results page, admin dashboard, camera proctoring | 2026-09-05 |
| 2 | Backend API, Prisma, email, proctor routes | 2026-09-05 |
| 3 | Refresh protection, anti-copy, live Socket.io | 2026-09-05 |
| 4 | Video upload/review, test email, Docker | 2026-09-06 |
| 5 | Hidden `/admin`, dynamic pass mark, camera release fixes | 2026-09-06 |
| 6 | Railway single-container deploy, question sync | 2026-09-06 |
| 7 | 48-hour lockout, multi-attempt tracking | 2026-09-06 |
| 8 | Hardening: auth on reads, tests, cooldown at submit | open |
