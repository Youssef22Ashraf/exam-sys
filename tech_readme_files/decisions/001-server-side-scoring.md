# ADR 001 — Score on the server, never trust the client

## Status
Accepted (2026-09-05)

## Context
The exam runs in the candidate's browser from a localStorage copy of the
question bank, which includes `correctAnswer`. Anything the browser
computes can be forged by anyone who opens DevTools. The result is used to
grant site access, so a forged pass has real consequences.

## Decision
`POST /api/exam/submit` in `backend/src/routes/examRoutes.ts` re-reads
every question from the database and computes Part A, Part B, total,
percentage, and pass/fail from the submitted `answers` map. The pass
threshold comes from `ExamSetting.passingPercentage` at submit time. The
client's own tally is used only for the instant preview.

## Consequences
- A tampered client can still see the correct answers (they are in
  localStorage). Removing them from the public `GET /api/questions`
  payload is a follow-up, not part of this decision.
- Scoring logic exists once, so a question-bank edit changes results
  consistently.
- The localStorage fallback path (ADR 005) scores locally when the API is
  unreachable; that result is marked as such and never synced.
