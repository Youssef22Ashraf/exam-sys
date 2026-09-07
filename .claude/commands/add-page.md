# Add page

No router (ADR 002). Follow `tech_readme_files/guides/04_how_to_add_new_page.md`:

1. `frontend/src/pages/Name.tsx` + `Name.css`; props in, callbacks out.
2. New `page` value + branch in `App.tsx`.
3. If reachable during the exam: `releaseCamera()` on every exit.
4. Settings/questions via `ExamStorage`, not fetch.
5. CSS variables from `styles.css`, no inline hex.
6. Admin-only → gate on `sessionStorage.adminToken` like `admin-dashboard`.
7. `CHANGELOG.md`, gate.
