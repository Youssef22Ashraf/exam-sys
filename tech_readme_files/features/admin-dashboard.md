> [INDEX](../INDEX.md) > [Features](README.md) > Admin dashboard

# Admin dashboard (`/admin`)

Hidden supervisor portal. No link from the candidate UI.

## Access

`App.tsx` switches to `admin-login` / `admin-dashboard` when
`location.pathname` is `/admin` or starts with `/admin/`, when the hash is
`#admin` / `#admin-login`, or on `Ctrl+Shift+A` (`Cmd` on Mac). Login
`POST /api/admin/login` returns a JWT stored in `sessionStorage.adminToken`;
`api.ts` attaches it as `Authorization: Bearer` on every request.
`authenticateAdmin` middleware guards mutations. Logout clears the token
and returns to `/`.

## Tabs (`AdminDashboard.tsx`, `activeTab`)

| Tab | Shows | Calls |
|---|---|---|
| `overview` | counts, pass rate, live feed from `admin:*` socket events | `GET /api/candidates`, `GET /api/exam/results` |
| `candidates` | search by name / ID / email, attempt history, delete, clear cooldown | `GET /candidates/:id/history`, `DELETE /candidates/:id`, `POST /candidates/:id/clear-cooldown` |
| `results` | filter PASSED/FAILED + search, answer sheet, snapshot, inline video, delete, CSV | `GET /exam/results?status&search`, `GET /exam/results/:id`, `DELETE /exam/results/:id`, `GET /exam/export/csv` |
| `exams` | question bank CRUD by section, settings form, test email | see [question-bank-and-settings.md](question-bank-and-settings.md) |

## Theme

`hooks/useTheme.ts` sets `data-theme="dark"` on `<html>` while
`AdminLogin` or `AdminDashboard` is mounted and removes it on unmount.
Tokens live at the top of `styles.css`; the dark palette is the
`[data-theme="dark"]` block. Toggle in the header, persisted under
`exam_admin_theme`, default from `prefers-color-scheme`. Candidate pages
never see the attribute.

## Files

`frontend/src/hooks/useTheme.ts`, `frontend/src/pages/AdminLogin.tsx`, `AdminDashboard.tsx` (~2000 lines,
single component), `AdminDashboard.css`, `backend/src/routes/authRoutes.ts`,
`backend/src/middleware/auth.ts`.

## Known gaps

- Read endpoints have no auth — `TODO.md` §Security item 1.
- ~~`admin/admin123` seeded; no password change UI.~~ Closed: accounts come
  from `ADMIN_INITIAL_PASSWORD` and Settings has a Change Password form.
- `AdminDashboard.tsx` should be split per tab before it grows further.
