# API integration

Adding an endpoint end to end — full steps in `tech_readme_files/guides/03_how_to_add_new_api.md`.

1. Schema in `backend/prisma/schema.prisma` → `npx prisma db push`.
2. Route in `backend/src/routes/<x>Routes.ts`; `prisma` from `../config/db`; parse JSON-string columns at the boundary; `try/catch` → `{ error }`.
3. `authenticateAdmin` unless it is register / submit / upload.
4. Method in `frontend/src/services/api.ts` with `getAuthHeaders()`, network first, `ExamStorage` fallback, never throw to a page.
5. Interface in `frontend/src/services/storage.ts` if the shape is new.
6. Row in `tech_readme_files/plan.md` §4 + `CHANGELOG.md`.
