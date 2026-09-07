# Review Code

Audit the given file(s) or diff against `AGENTS.md` and report one line per finding: `path:line: severity: problem. fix.`

## Check

1. **Scoring / trust** — any pass/fail or percentage computed in `frontend/src/pages/` that lands in the DB or email.
2. **Auth** — a `POST/PUT/DELETE` in `backend/src/routes/` without `authenticateAdmin` that isn't `register`, `submit`, or `upload-*`. Any new public `GET` returning candidate fields.
3. **Prisma** — `new PrismaClient()` outside `config/db.ts` / `seed.ts`. `JSON.parse` of `options`/`answers` in a page. Schema change without a note about `db push` destructiveness.
4. **Camera** — a new transition away from the exam page that doesn't call `releaseCamera()`.
5. **Question bank** — an edit to one of seed / defaultQuestions / INITIAL_QUESTIONS without the other two.
6. **Literals** — `70`, `30`, `48` hardcoded where `ExamStorage.getSettings()` or the cooldown constant should be used.
7. **Fallback shape** — an `api.ts` method that throws instead of returning the `ExamStorage` equivalent.
8. **Secrets / PII** — `.env`, `.db`, `uploads/` in the diff; `console.log` of candidate name/email/answers.
9. **Docs** — code change without a `CHANGELOG.md` Unreleased line.

## Output

Findings ranked by severity. No praise. End with the gate result:
`cd backend && npx tsc --noEmit; cd frontend && npm run lint && npx tsc -b`.
