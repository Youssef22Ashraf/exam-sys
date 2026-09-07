# Add API endpoint

Follow `tech_readme_files/guides/03_how_to_add_new_api.md` exactly:

1. Schema change? → `backend/prisma/schema.prisma`, `npx prisma db push`, state if destructive.
2. Route in the matching `backend/src/routes/<x>Routes.ts` — `prisma` from `../config/db`, parse JSON columns, `try/catch` → `{ error }`.
3. `authenticateAdmin` unless register / submit / upload.
4. `frontend/src/services/api.ts` method: `getAuthHeaders()`, try fetch, fall back to `ExamStorage`, never throw.
5. New interface → `frontend/src/services/storage.ts`.
6. `tech_readme_files/plan.md` §4 row, `CHANGELOG.md` Unreleased, `features/*.md`.
7. Run the gate. Report what ran.
