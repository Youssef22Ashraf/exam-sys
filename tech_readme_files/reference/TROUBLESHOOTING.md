> [INDEX](../INDEX.md) > Troubleshooting

# Troubleshooting

## Frontend shows old questions after editing the bank
`App.tsx` refreshes on mount only. Reload the tab. If still stale,
`localStorage.removeItem("exam_system_questions")`.

## `GET /api/questions` returns `[]`
DB not seeded. `cd backend && npm run seed`. `POST /submit` also 500s with
"No exam questions found" in this state.

## Webcam light stays on after the exam
A new exit path skipped `releaseCamera()`. Grep `setPage(` in `App.tsx`
and `Exam.tsx`; every transition away from `exam` must call it first.

## Video won't play in admin
- File missing from `backend/uploads/videos/` — upload failed (check the
  200 MB cap and the browser console).
- In Docker, `uploadsDir` resolves to `dist/../uploads`; make sure the
  volume is mounted at `/app/backend/uploads`, not `/app/uploads`.

## `Invalid or expired token` in admin
JWT signed with a different `JWT_SECRET` than the server now has. Log out
and in. In prod, a secret rotation logs everyone out — expected.

## Email never arrives
`createTransporter()` returns `null` unless `SMTP_HOST`, `SMTP_USER`, and
`SMTP_PASS` are **all** set. Check server log for "SMTP not configured".
Gmail needs an App Password. Use the admin "Send test" button.

## Cooldown says blocked but admin cleared it
The server honours `cooldownClearedAt`; a browser with the local result in
`exam_system_results` may still block via the localStorage fallback when
the API is unreachable. Clear localStorage or restore connectivity.

## `prisma db push` in the container wipes data
You changed a column type or name. See ADR 007. Restore `dev.db` from the
volume backup you took first.

## Vite dev server doesn't see file changes (WSL2 / network drive)
`vite.config.ts` already uses `usePolling`. If still stuck, raise
`interval` or move the repo off the mounted volume.

## `tsc -b` fails in frontend on a type from `storage.ts`
`api.ts` and `storage.ts` share interfaces; add new fields to the interface
before using them in a page.
