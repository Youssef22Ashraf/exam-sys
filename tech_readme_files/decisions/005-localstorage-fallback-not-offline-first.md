# ADR 005 — API fallback to localStorage is graceful degradation, not offline-first

## Status
Accepted (2026-09-05). **Submit half superseded by
[ADR 008](008-submit-must-reach-the-server.md) (2026-09-07)** — a submit that
cannot reach the server is now a visible error, not a local pass. Read
fallbacks are unchanged.

## Context
The first two days of the project had no backend; the whole app ran from
localStorage. When the API arrived, ripping the local layer out risked
breaking a working candidate flow days before delivery.

## Decision
Every method in `frontend/src/services/api.ts` tries the network and, on
any failure, falls back to the equivalent `ExamStorage` call. The exam
itself always reads questions and settings from localStorage (refreshed
from the API on app mount). A submit that fell back is stored locally and
**never** uploaded later.

## Consequences
- A candidate can finish the exam through an API blip.
- A result produced on the fallback path is invisible to admin and
  triggers no email. This is a known limitation, not a bug — see
  `CURRENT_STATUS.md` §Deliberately descoped.
- The local question bank (`INITIAL_QUESTIONS`) must match the seed, hence
  the triplication rule in `CLAUDE.md`.
