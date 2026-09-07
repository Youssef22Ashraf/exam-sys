# ADR 004 — 48-hour lockout keyed on email OR company ID

## Status
Accepted (2026-09-06)

## Context
Candidates have no accounts. Identity at registration is a free-text
name, a company employee ID, and an email. The client wants a failed
candidate to wait 48 hours before retrying, and a second email address
must not bypass that.

## Decision
`GET /api/candidates/check-cooldown` looks up the newest `ExamAttempt`
where `candidateEmail = email OR companyId = companyId` and applies a
48-hour window from its `submittedAt`. The client mirrors the check in
`ExamStorage.checkCandidateCooldown` for the offline path. Admin
`clear-cooldown` overrides.

## Consequences
- Changing either identifier alone does not evade the lockout.
- A typo in company ID at first registration creates a candidate row
  that a later correct ID will not match — admin must merge by hand.
- The check is only at registration. Enforcing it inside
  `POST /api/exam/submit` is `TODO.md` Phase 8, item 2.
