> [INDEX](../INDEX.md) > Common pitfalls

# Common pitfalls

| Don't | Do | Why |
|---|---|---|
| Compute pass/fail in a page | Read it from the `/submit` response | ADR 001 |
| Edit one copy of a question | Edit seed + defaultQuestions + INITIAL_QUESTIONS | CLAUDE.md |
| `new PrismaClient()` in a route | `import { prisma } from "../config/db"` | connection leaks in dev reload |
| `JSON.parse(q.options)` in a React page | Parse in the route; pages get arrays | boundary rule |
| Add a mutation route without `authenticateAdmin` | Add it, unless it's register/submit/upload | AGENTS.md §Rules |
| Leave the exam page without `releaseCamera()` | Call it on every path | webcam light stays on |
| Hardcode `70` or `30` anywhere | `ExamStorage.getSettings()` | fixed once already (15f57fa) |
| Throw from `api.ts` on network error | Return the `ExamStorage` fallback | ADR 005 |
| Rename a Prisma column and push | Add new column, copy, drop later — and say it's destructive | ADR 007 |
| Use `localStorage` for exam progress | `sessionStorage` `exam_session_<email>` | survives reload, dies with tab |
| Put admin token in `localStorage` | `sessionStorage.adminToken` | dies with tab, as intended |
| Trust `tabSwitches` as fact | Treat as a client claim | it's self-reported |
| Commit `.env`, `dev.db`, `uploads/` | Check `git status` before commit | PII + video |
| Say "tests pass" | Say "tsc and lint pass" | there are no tests |
| Reuse a deleted question id | Next id = max+1 | CSV and answer sheets key on id |
| Read-then-write across two Prisma calls | `prisma.$transaction(async tx => …)` | concurrent requests interleave |
| Backdate a timestamp to change behaviour | Add a state column (`cooldownClearedAt`) | timestamps are audit data |
