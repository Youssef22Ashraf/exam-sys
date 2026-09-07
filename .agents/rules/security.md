# Security

- Never commit `backend/.env`, `*.db`, or `backend/uploads/**`. They hold candidate PII and webcam video.
- Never paste real SMTP passwords or a production `JWT_SECRET` into a tracked file. `admin/admin123` and the fallback secret are dev-only.
- Schema changes go through `schema.prisma` + `prisma db push`; renames/type changes are destructive in production — say so first.
- Do not add public read endpoints that return candidate data. The existing ones are a known gap (`tech_readme_files/TODO.md` Phase 8).
- Never log candidate identity or answers.
