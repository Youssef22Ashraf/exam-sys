# ADR 008 — A submit must reach the server, and the server owns the clock

## Status
Accepted (2026-09-07). Supersedes the submit half of
[ADR 005](005-localstorage-fallback-not-offline-first.md); completes the
follow-up ADR 001 deferred.

## Context

Three things undercut the guarantees ADR 001 was written to provide.

1. **The answer key was public.** `GET /api/questions` required no auth and
   returned `correctAnswer` for all 40 questions, and `INITIAL_QUESTIONS` in
   `frontend/src/services/storage.ts` shipped the same answers inside the
   candidate's JS bundle. Scoring on the server is worth nothing when the key
   is one `curl` away. ADR 001 named this and left it as "a follow-up".
2. **A failed submit became a local pass.** Per ADR 005, `api.submitExam`
   caught any network error, scored the attempt from localStorage, and
   returned a result the candidate saw as authoritative. No admin ever saw
   that attempt and no email announced it. Blocking the request in DevTools
   produced a pass screen; a genuine network blip silently destroyed an
   honest candidate's result.
3. **Proctoring was self-reported.** `timeSpentSeconds`, `tabSwitches` and
   `proctoringStatus` were body fields on `POST /api/exam/submit`, trusted
   verbatim. A candidate could alt-tab twenty times and post
   `tabSwitches: 0, proctoringStatus: "Verified"`. There was no server-side
   exam clock at all, so a submit could arrive hours after a 30-minute exam
   began. `CameraProctor`'s "Use Simulation" button set `hasPermission = true`
   without a camera and filed a drawn avatar — stamped with the candidate's
   name and the word "Verified" — as the identity snapshot.

A pass grants site access. Each of these turns the exam into a formality for
anyone who opens DevTools.

## Decision

**The answer key never leaves the server for a non-admin.**
`GET /api/questions` runs behind a new `optionalAdmin` middleware
(`backend/src/middleware/auth.ts`) and includes `correctAnswer` only when the
request carries a valid admin JWT. `Question.correctAnswer` is optional in the
frontend type, and `INITIAL_QUESTIONS` carries no answers.

**A submit that does not reach the server is an error.** The local scoring
fallback in `api.submitExam` is deleted. Failures throw `SubmitFailedError`,
which carries a `retryable` flag: a transport failure re-arms the submit
button behind a visible banner (the draft is still in `sessionStorage`), while
a deliberate server refusal such as a cooldown 403 ends the attempt on a
terminal screen. That refusal screen used to be nested inside the
`!question` branch of `Exam.tsx`, which is false in the normal case — a
refused submit rendered nothing at all. It is now reachable.

**The server owns the clock and the warning count.** A new `ExamSession` row
is created by `POST /api/exam/start` when the exam page mounts, and
`POST /api/exam/submit` requires its id. From it the server derives
`timeSpentSeconds`, and it refuses a submit arriving more than
`durationMinutes + 5 minutes` after `startedAt`. The `candidate:warning`
socket handler increments `serverWarnings` on the session, and the recorded
`tabSwitches` is `max(client, serverWarnings)` — the client can raise the
count, never lower it. `proctoringStatus` is derived
(`services/examSession.ts`), never accepted from the body: no recording means
`Camera Disabled` regardless of what the client claims. A session is bound to
one candidate email, is spent on submit, and cannot be replayed.

**"Use Simulation" is removed.** A candidate who declines the camera now sees
that the attempt will be filed as `Camera Disabled`.

## Consequences

- An API blip now blocks a candidate instead of silently discarding their
  result. That is the correct failure direction for an exam that grants
  access: a candidate who is stopped can retry, whereas one whose result
  vanished had no idea.
- **The exam can no longer be taken offline.** The localStorage question bank
  still backs the *display* path, but without a session id nothing can be
  submitted, so an offline sitting is pointless. The rest of ADR 005 — reads
  falling back to `ExamStorage` — is unchanged.
- **The question bank is no longer triplicated identically.** `seed.ts` and
  `config/defaultQuestions.ts` still carry answers; `INITIAL_QUESTIONS` must
  not. Wording still has to be changed in all three. See `CLAUDE.md`.
- A candidate who reloads mid-exam rejoins the same sitting: the session id is
  held in `sessionStorage`, so the server's clock is not reset by a refresh.
- Scoring moved to a pure `services/scoring.ts` so it can be unit-tested
  without an HTTP request, and identity/email validation moved out of
  `candidateRoutes.ts` so `examRoutes.ts` no longer imports from a sibling
  router.
- The 5-minute grace exists because the video upload happens before the
  submit and can take tens of seconds on a slow link. If uploads are moved
  off the submit path, the grace can shrink.
