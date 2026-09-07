# Architecture Decision Records

> [INDEX](../INDEX.md) > Decisions
>
> Short files capturing **why** a design choice was made. Format:
> Context → Decision → Consequences. New ADRs supersede or amend old ones;
> old ones stay as history. Dates are when the decision landed in git.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [001](001-server-side-scoring.md) | Score on the server, never trust the client | Accepted | 2026-09-05 |
| [002](002-no-router-no-state-library.md) | Page-string navigation and localStorage instead of a router / state library | Accepted | 2026-09-04 |
| [003](003-single-container-spa-plus-api.md) | One container, one port: Express serves the built SPA | Accepted | 2026-09-06 |
| [004](004-cooldown-identity-email-or-company-id.md) | 48-hour lockout keyed on email OR company ID | Accepted | 2026-09-06 |
| [005](005-localstorage-fallback-not-offline-first.md) | API fallback to localStorage is graceful degradation, not offline-first | Accepted | 2026-09-05 |
| [006](006-webcam-recording-indexeddb-then-upload.md) | Buffer the webcam recording in IndexedDB, upload one `.webm` on submit | Accepted | 2026-09-06 |
| [007](007-prisma-db-push-not-migrate.md) | `prisma db push` on boot instead of migrations | Accepted | 2026-09-06 |

## Template

```markdown
# ADR NNN — Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX] (YYYY-MM-DD)

## Context
What problem, what forces. 2–4 sentences.

## Decision
"We will …". 2–4 sentences.

## Consequences
Good, bad, and what it rules out. Bullets.
```
