# Conventions

- Server scores. `POST /api/exam/submit` computes pass/fail; pages only display.
- One `PrismaClient`: import `prisma` from `backend/src/config/db.ts`.
- `authenticateAdmin` on every mutation except `candidates/register`, `exam/submit`, `proctor/upload-*`.
- `Question.options` and `ExamAttempt.answers` are JSON strings — parse in the route, not the page.
- `api.ts` methods try network, fall back to `ExamStorage`, never throw to a page.
- Every path leaving the exam screen calls `releaseCamera()`.
- Question bank lives in `seed.ts`, `defaultQuestions.ts`, `storage.ts INITIAL_QUESTIONS` — change all three.
- Duration and pass mark come from `ExamStorage.getSettings()`, never literals.
- No new dependencies without a `CHANGELOG.md` line.
- Gate before done: `cd backend && npx tsc --noEmit`; `cd frontend && npx tsc -b`. No tests exist — don't claim they pass.
