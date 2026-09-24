# CLAUDE.md

Conventions for this repo live in [AGENTS.md](AGENTS.md) — read that first,
always. This file only covers tool-use rules specific to working here.

- Quality gate before calling any task done, all four:
  `cd backend && npx tsc --noEmit && npm test`
  `cd frontend && npx tsc -b && npm run lint && npm test`
  Lint is green (0 errors, 0 warnings) — keep it that way. The suites are
  vitest; 54 backend tests (supertest for HTTP) and 18 frontend
  (testing-library + jsdom). `.github/workflows/ci.yml` runs the same gate on
  every push. Say which checks actually ran; never claim more.
- `backend/prisma/schema.prisma` is the data contract. Change the schema
  first, then `npx prisma db push` (dev) — never hand-edit `dev.db`.
  `prisma migrate` is not in use; the Dockerfile runs `prisma db push` on
  boot, so a destructive schema change wipes production rows. Say so before
  making one.
- The question bank wording lives in **three** places that must stay
  identical, but only the two backend copies carry `correctAnswer` —
  `INITIAL_QUESTIONS` must never regain the answers, they ship in the
  candidate's bundle (ADR 008). The three places:
  `backend/prisma/seed.ts`, `backend/src/config/defaultQuestions.ts`, and
  `INITIAL_QUESTIONS` in `frontend/src/services/storage.ts`. Edit all three
  in one commit or none. Source of truth for the wording is
  `interface questions.txt` / `stakeholder questions.txt` at repo root.
- Never commit `backend/.env`, `*.db`, or anything under
  `backend/uploads/{videos,snapshots}` — they hold candidate PII and
  webcam recordings. `.gitignore` already excludes them; do not weaken it.
- There are no default credentials in the code. Admin accounts are created
  from `ADMIN_INITIAL_PASSWORD`; production refuses to boot without it, and
  refuses to boot on a `JWT_SECRET` that has ever appeared in this repo (the
  denylist is in `backend/src/config/env.ts`). Dev falls back to
  `devadmin1234`. Never paste a real SMTP password, admin password, or
  production JWT secret into a tracked file — not in README or compose either.
- `ref-for ui/` holds the client's WhatsApp screenshots of the target UI.
  Read-only reference — never edit, never delete.
- All docs (`plan.md`, `TODO.md`, `CURRENT_STATUS.md`, `decisions/`, `features/`,
  `guides/`, `reference/`) live under
  `tech_readme_files/` — start at `tech_readme_files/INDEX.md`. `AGENTS.md`, `CLAUDE.md`, `README.md`, and
  `CHANGELOG.md` stay at repo root. Update `CHANGELOG.md` and tick
  `TODO.md` in the same commit as the code they describe.
