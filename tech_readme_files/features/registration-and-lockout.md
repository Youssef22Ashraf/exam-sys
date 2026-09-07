> [INDEX](../INDEX.md) > [Features](README.md) > Registration & lockout

# Registration & 48-hour lockout

Candidate enters name, company employee ID, and email. Before proceeding
the app asks the server whether this identity sat an exam in the last
48 hours; if so it shows the remaining hours and reopen time and refuses.

## Flow

1. `ExamRegistration.tsx` trims inputs, validates non-empty + email shape.
2. Calls `api.checkCandidateCooldown(email, companyId)` →
   `GET /api/candidates/check-cooldown`. On network failure falls back to
   `ExamStorage.checkCandidateCooldown`, which scans local results.
3. `eligible:false` → render the lockout card with `remainingHours`,
   `nextAttemptAvailableAt`, and the upcoming `attemptNumber`.
4. `eligible:true` → `App.handleRegistration` calls
   `ExamStorage.registerOrUpdateCandidate` and `POST /api/candidates/register`,
   then moves to `instructions`.

## Server rule

Newest `ExamAttempt` where `candidateEmail = email OR companyId = id`;
eligible only if `now - submittedAt >= 48h`. See
[ADR 004](../decisions/004-cooldown-identity-email-or-company-id.md).

## Files

| File | Role |
|---|---|
| `frontend/src/pages/ExamRegistration.tsx` | form + lockout card |
| `frontend/src/services/api.ts` `checkCandidateCooldown`, `registerCandidate` | network + fallback |
| `frontend/src/services/storage.ts` `checkCandidateCooldown`, `registerOrUpdateCandidate` | local mirror |
| `backend/src/routes/candidateRoutes.ts` | `check-cooldown`, `register`, `clear-cooldown` |
| `backend/src/services/cooldown.ts` | `findActiveCooldown` — shared by `check-cooldown` and `exam/submit` |

## Known gaps

