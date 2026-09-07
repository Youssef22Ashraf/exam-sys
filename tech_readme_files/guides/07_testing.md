> [INDEX](../INDEX.md) > Guides > Testing

# 07 — Testing

**There are no automated tests.** The gate is compile + lint:

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc -b
```

## Manual smoke (do this before every deploy)

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
