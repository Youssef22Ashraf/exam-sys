# ADR 007 — `prisma db push` on boot instead of migrations

## Status
Accepted (2026-09-06)

## Context
SQLite on a Railway volume, one developer, schema still moving daily.
`prisma migrate deploy` needs a migrations folder kept in sync and fails
hard on drift; `db push` reconciles the live DB to the schema.

## Decision
The Dockerfile `CMD` runs `npx prisma db push && node dist/index.js`. No
`prisma/migrations/` directory is committed.

## Consequences
- Zero migration bookkeeping while the schema is young.
- A column rename or type change is destructive under `db push` — rows
  are dropped without a prompt in non-interactive mode. `CLAUDE.md`
  requires saying so before making one.
- Moving to Postgres for real production is the moment to switch to
  `migrate` (`TODO.md` §Later).
