> [INDEX](../INDEX.md) > Onboarding

# Onboarding

Day-1 checklist for an agent or human picking this repo up cold.

## First 6 commands

```bash
cd backend && npm install && cp -n .env.example .env && npx prisma db push && npm run seed && npm run dev   # :5000
cd frontend && npm install && npm run dev                                                                  # :5173
```

Then open `http://localhost:5173`, and `http://localhost:5173/admin`
(`admin` / `admin123`) in a second window.

## Read in order

| Step | File | Why |
|---|---|---|
| 1 | [`../../README.md`](../../README.md) | pitch, stack, deploy steps |
| 2 | [`../../AGENTS.md`](../../AGENTS.md) | conventions, rules, commands |
| 3 | [`../../CLAUDE.md`](../../CLAUDE.md) | the six things that bite |
| 4 | [`../CURRENT_STATUS.md`](../CURRENT_STATUS.md) | what is verified vs. assumed |
| 5 | [guides/02_architecture.md](../guides/02_architecture.md) | the request lifecycle |
| 6 | [COMMON_PITFALLS.md](COMMON_PITFALLS.md) | don't X, do Y |
| 7 | [`../TODO.md`](../TODO.md) Phase 8 | what to do next |

## Key facts to hold

- Server scores. Client previews.
- Question bank is in three files.
- No tests. Gate = `tsc` + `lint`.
- Results endpoints are public today. Fix before the URL is shared.
- Every exit from the exam calls `releaseCamera()`.
