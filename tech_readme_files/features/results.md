> [INDEX](../INDEX.md) > [Features](README.md) > Results

# Results

Instant certificate screen after submit: score, percentage, Part A / B
breakdown, pass or fail, attempt number, and the retest policy line.

## Where the numbers come from

`POST /api/exam/submit` re-scores from DB questions and the current
`passingPercentage` ([ADR 001](../decisions/001-server-side-scoring.md)),
upserts the `Candidate`, computes `attemptNumber = totalAttempts + 1`,
creates the `ExamAttempt`, sends the email, and returns the attempt.
`Exam.tsx` awaits that response, merges it over the local preview
(keeping `passingPercentage` for display), and hands it to
`ExamResults.tsx`. A `403 COOLDOWN_ACTIVE` renders a "Submission
refused" screen. If the API was unreachable,
the locally computed `ExamResult` is shown and stored with
`ExamStorage.recordExamResult`; it is never synced later
([ADR 005](../decisions/005-localstorage-fallback-not-offline-first.md)).

## Files

`frontend/src/pages/ExamResults.tsx` / `.css`, `frontend/src/services/api.ts`
`submitExam`, `backend/src/routes/examRoutes.ts` `submit`.

## Known gaps

- None open.
