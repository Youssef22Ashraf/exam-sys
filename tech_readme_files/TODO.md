# TODO — Workplace Assessment & Examination Platform

Working checklist. Specification lives in [plan.md](plan.md); what is
verified vs. assumed lives in [CURRENT_STATUS.md](CURRENT_STATUS.md).
Section references (§) point at `plan.md`.

**Rules**: one phase at a time, finished completely. A phase is done only
when every box under it is ticked, backend `tsc --noEmit` is clean,
frontend `tsc -b` is clean, and `CHANGELOG.md` is updated.

---

## 0. Blockers — need the client (§5)

- [ ] Confirm results/CSV may go behind admin login (nobody uses the public link)
- [ ] Video retention period and who deletes
- [ ] SQLite-on-volume vs. Postgres for production
- [ ] Retest identity: email OR company ID (current) vs. company ID only
- [ ] Question / option randomisation wanted or not
- [ ] Real SMTP account and recipient list for production
- [ ] Change `admin/admin123` on first deploy — who holds the new password

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

- [x] **Auth on every read that returns candidate data**: `GET /api/candidates`,
      `/candidates/:id/history`, `/exam/results`, `/exam/results/:id`,
      `/exam/export/csv`, `/proctor/video/:filename`, `/proctor/download/:filename`,
      `POST /settings/test-email`. `?token=` accepted for `<video src>`. (fix/auth-on-read-endpoints)
- [x] **Enforce cooldown in `POST /api/exam/submit`** — shared `services/cooldown.ts`,
      403 `COOLDOWN_ACTIVE`. Proven live: 2nd submit same email 403, same company ID 403,
      unrelated 201. (fix/cooldown-at-submit)
- [x] Apply `CORS_ORIGIN` to both `cors()` and the Socket.io `cors.origin`; keep `*` only when unset (fix/cors-and-jwt-boot-guard)
- [x] Refuse to boot in production when `JWT_SECRET` is the fallback string (`config/env.ts`)
- [ ] Rate-limit `POST /api/admin/login`
- [ ] Validate `videoFilename` / `candidatePhoto` at submit are basenames (no `../`)

### Correctness — do now

- [ ] `attemptNumber` = candidate attempt count + 1, read then written outside a transaction; two concurrent submits for one candidate collide. Wrap upsert + count + create in `prisma.$transaction`
- [ ] `POST /api/questions` picks `max(id)+1` outside a transaction; concurrent adds collide on the primary key
- [ ] `.dockerignore` excludes `*.md`, so any future runtime read of a markdown file (email template, instructions) will fail in the image
- [ ] `clear-cooldown` backdates `lastAttemptAt` and every attempt's `submittedAt` — it rewrites audit timestamps. Prefer a `cooldownClearedAt` column that `check-cooldown` honours
- [ ] README says Prisma 6; `package.json` pins `^5.18`. Pick one

### Lint — never been green

- [ ] Frontend `npm run lint`: 43 errors. Mostly `catch (err)` unused → `catch {}`, `any` in socket/api, empty blocks → add a comment. Until then the frontend gate is `tsc -b` only.

### Tests — none exist

- [ ] Backend: vitest + supertest. First three: scoring in `submit`, cooldown boundary at exactly 48 h, `authenticateAdmin` rejects missing/expired token
- [ ] Frontend: vitest + testing-library. First two: `ExamStorage.checkCandidateCooldown`, timer auto-submit
- [ ] CI: one GitHub Actions job running both gates + tests on push

### Later / nice to have

- [ ] Collapse the triplicated question bank to one source (`defaultQuestions.ts`) that seed and a build step both read
- [ ] Postgres provider + `prisma migrate` instead of `db push` on boot
- [ ] Video retention job (delete `.webm` older than N days, keep the attempt row)
- [ ] Question / option shuffle per attempt, seeded and stored so the answer sheet replays correctly
- [ ] Replace `page` string state with a real router if a third top-level area appears
- [ ] Remove `console.log` of candidate data in `App.tsx` `beginExam` and socket handlers
