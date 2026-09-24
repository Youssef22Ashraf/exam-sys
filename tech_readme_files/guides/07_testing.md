> [INDEX](../INDEX.md) > Guides > Testing

# 07 — Testing

The gate is compile, lint and test — all four commands:

```bash
cd backend  && npx tsc --noEmit && npm test
cd frontend && npx tsc -b && npm run lint && npm test
```

`.github/workflows/ci.yml` runs exactly this on every push and pull request,
plus the production build and two artefact assertions (no answer key in the
built bundle, no known credential in a tracked file).

## Automated tests

72 tests, vitest in both packages. `npm test` runs once; `npm run test:watch`
watches.

**Backend** — `backend/tests/`, config in `backend/vitest.config.ts`.
Integration tests use supertest against the Express app; `src/index.ts` only
calls `listen()` when it is the main module, so importing it in a test binds
no port. `tests/globalSetup.ts` builds a throwaway `prisma/test.db` and
deletes it afterwards — the suite never touches `dev.db`.

| File | Covers |
| --- | --- |
| `scoring.test.ts` | `scoreExam`: threshold, section split, string indexes, empty bank |
| `cooldown.test.ts` | the 48-hour boundary, email-or-company matching (ADR 004), admin clears |
| `auth.test.ts` | `authenticateAdmin`, `optionalAdmin`, `requireRole` |
| `api.test.ts` | HTTP-level regression guards for the hardening work (ADR 008) |

**Frontend** — colocated `*.test.ts(x)`, config in `frontend/vitest.config.ts`,
jsdom plus testing-library. `src/test/setup.ts` stubs `mediaDevices` and
`MediaRecorder`, which jsdom does not provide.

| File | Covers |
| --- | --- |
| `services/storage.test.ts` | `checkCandidateCooldown`, and that a cold cache returns empty |
| `pages/Exam.test.tsx` | the timer: opens a sitting, stores a deadline, resumes it, auto-submits |

Writing a new one: prefer a pure function in `services/` over a route handler
— that is why `scoring.ts`, `cooldown.ts` and `examSession.ts` exist as
services rather than inline route code.

## Manual smoke (still do this before every deploy)

1. Fresh DB: `rm backend/prisma/dev.db && cd backend && npx prisma db push && npm run seed`.
2. Register with a new email + ID → instructions → exam. Confirm webcam light on.
3. Switch tab once. Confirm the in-exam warning and, in a second window on `/admin`, the live feed entry.
4. Answer a few, submit. Confirm webcam light **off**, result screen, attempt #1.
5. Admin → results: answer sheet, snapshot, video plays with seek.
6. Register again with the same email → lockout card with hours remaining.
7. Admin → candidates → clear cooldown → register again succeeds, attempt #2, email subject has `[RE-ATTEMPT #2]` (if SMTP set).
8. Admin → exams → change pass mark → next result reflects it.

## Adding the first tests (TODO Phase 8)

Backend: `vitest` + `supertest`, `DATABASE_URL=file:./test.db`. First
three: scoring in `submit`, cooldown boundary at exactly 48 h,
`authenticateAdmin` rejects missing/expired token. Frontend: `vitest` +
`@testing-library/react`; first two: `ExamStorage.checkCandidateCooldown`,
timer auto-submit with fake timers.
