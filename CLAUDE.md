# CLAUDE.md

Conventions for this repo live in [AGENTS.md](AGENTS.md) — read that first,
always. This file only covers tool-use rules specific to working here.

- Quality gate before calling any task done:
  `cd backend && npx tsc --noEmit` and `cd frontend && npm run lint && npx tsc -b`.
  There is no test suite yet (see `tech_readme_files/TODO.md` §Hardening) —
  do not claim "tests pass"; say the gate that actually ran.
- `backend/prisma/schema.prisma` is the data contract. Change the schema
  first, then `npx prisma db push` (dev) — never hand-edit `dev.db`.
  `prisma migrate` is not in use; the Dockerfile runs `prisma db push` on
  boot, so a destructive schema change wipes production rows. Say so before
  making one.
- The question bank lives in **three** places that must stay identical:
  `backend/prisma/seed.ts`, `backend/src/config/defaultQuestions.ts`, and
  `INITIAL_QUESTIONS` in `frontend/src/services/storage.ts`. Edit all three
  in one commit or none. Source of truth for the wording is
  `interface questions.txt` / `stakeholder questions.txt` at repo root.
- Never commit `backend/.env`, `*.db`, or anything under
  `backend/uploads/{videos,snapshots}` — they hold candidate PII and
  webcam recordings. `.gitignore` already excludes them; do not weaken it.
- Default credentials (`admin` / `admin123`) and the fallback `JWT_SECRET`
  are seeded for local dev only. Never paste real SMTP passwords or a
  production JWT secret into a tracked file.
- `ref-for ui/` holds the client's WhatsApp screenshots of the target UI.
  Read-only reference — never edit, never delete.
- All docs (`plan.md`, `TODO.md`, `CURRENT_STATUS.md`, `decisions/`, `features/`,
  `guides/`, `reference/`) live under
  `tech_readme_files/` — start at `tech_readme_files/INDEX.md`. `AGENTS.md`, `CLAUDE.md`, `README.md`, and
  `CHANGELOG.md` stay at repo root. Update `CHANGELOG.md` and tick
  `TODO.md` in the same commit as the code they describe.
