# ADR 002 — Page-string navigation and localStorage instead of a router / state library

## Status
Accepted (2026-09-04)

## Context
The candidate flow is strictly linear (home → registration →
instructions → exam → results) and must not be navigable backwards or by
URL — a candidate should not be able to reload into the exam from a
bookmark, or reach results without submitting. The admin portal is the
only other top-level area.

## Decision
`App.tsx` holds a single `page` string and renders one component per
value. `/admin` is detected from `location.pathname` or `#admin` and the
`Ctrl+Shift+A` hotkey. Client state lives in localStorage behind
`ExamStorage` (`services/storage.ts`); cross-tab sync uses a
`BroadcastChannel`. No react-router, no Redux/Zustand.

## Consequences
- Zero routing dependencies; the whole navigation model is ~60 lines.
- Browser back/forward does nothing inside the candidate flow, which is
  what the client wants.
- Adding a third top-level area (e.g. a supervisor-only live view with its
  own URL) is the trigger to introduce a router. See `TODO.md` §Later.
- Exam progress survives reload via `sessionStorage`, keyed per session,
  so a refresh mid-exam resumes rather than restarts.
