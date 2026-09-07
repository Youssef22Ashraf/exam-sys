> [INDEX](../INDEX.md) > Guides > Add a new API

# 03 — How to add a new API endpoint

Example: `GET /api/candidates/:id/summary`.

1. **Schema first** if it needs a new column: edit
   `backend/prisma/schema.prisma`, run `cd backend && npx prisma db push`.
   Say in the PR if the change is destructive under `db push`
   ([ADR 007](../decisions/007-prisma-db-push-not-migrate.md)).
2. **Route**: add to the matching `backend/src/routes/<x>Routes.ts`.
   Import `prisma` from `../config/db`. Parse JSON-string columns
   (`options`, `answers`) at the boundary. Wrap in `try/catch`, return
   `{ error }` with a status; the global handler in `index.ts` catches
   the rest.
3. **Auth**: any mutation, and any read that returns candidate data,
   takes `authenticateAdmin` from `../middleware/auth`. The three
   candidate-facing writes (`register`, `submit`, `upload-*`) are the
   only exceptions.
4. **Client**: add a method to `frontend/src/services/api.ts`. Use
   `getAuthHeaders()`. Follow the existing shape: try `fetch`, on failure
   return the `ExamStorage` equivalent (or a safe default) — never throw
   to a page ([ADR 005](../decisions/005-localstorage-fallback-not-offline-first.md)).
5. **Types**: if the response shape is new, add the interface to
   `frontend/src/services/storage.ts` next to `Candidate` / `ExamResult`.
6. **Docs**: add the row to `plan.md` §4 table, note it in
   `CHANGELOG.md` Unreleased, and the relevant `features/*.md`.
7. **Gate**: `cd backend && npx tsc --noEmit`; `cd frontend && npm run lint && npx tsc -b`.

## Socket event instead of REST?

Only for admin-facing live notifications. Add the `socket.on` in
`backend/src/index.ts`, rebroadcast as `admin:<noun>` with `timestamp`,
add an `emitX` helper in `frontend/src/services/socket.ts`.
