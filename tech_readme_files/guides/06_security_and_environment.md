> [INDEX](../INDEX.md) > Guides > Security & environment

# 06 — Security & environment

## Env vars (`backend/.env`, never committed)

| Var | Required in prod | Notes |
|---|---|---|
| `PORT` | no (5000) | |
| `DATABASE_URL` | yes | `file:./dev.db` or a Postgres URL |
| `JWT_SECRET` | **yes** | fallback string in `auth.ts` is public in git |
| `NODE_ENV` | yes | `production` disables Prisma query logging |
| `CORS_ORIGIN` | — | read but not applied; `TODO.md` §Security 3 |
| `SMTP_HOST/PORT/USER/PASS` | for email | all three of host/user/pass or no transport |
| `ADMIN_ALERT_EMAIL` | for email | overridden by `ExamSetting.notifyEmail` |

Frontend: `VITE_API_URL` optional; otherwise same-origin off localhost.

## What is protected today

`authenticateAdmin` on: question CRUD/reset, settings `PUT`, candidate
delete, clear-cooldown, result delete, `admin/me`.

## What is not (fix before sharing the URL)

All candidate/result/video reads, CSV export, `test-email`. Listed in
`TODO.md` Phase 8 §Security with the exact endpoints.

## Rules

- Secrets only in env. `.env.example` holds placeholders.
- `uploads/` and `*.db` hold PII and webcam video — gitignored, volume-mounted, never in a bug report.
- Change `admin/admin123` on first deploy: log in, then update `passwordHash` via a one-off script (no UI yet).
- `tls.rejectUnauthorized:false` in `emailService.ts` disables cert checks. Acceptable for a known Office 365 host; not for arbitrary SMTP.
- Never log candidate identity or answers. `App.tsx beginExam` and the socket handlers currently do — `TODO.md` §Later.
