> [INDEX](../INDEX.md) > [Features](README.md) > Question bank & settings

# Question bank & settings

## Question bank

`Question` rows: `id` (hand-assigned Int), `section` `"A"|"B"`,
`sectionTitle`, `question`, `options` (JSON string array),
`correctAnswer` (0-based). Admin CRUD is `POST/PUT/DELETE /api/questions`;
`POST /api/questions/reset` wipes and reloads from
`backend/src/config/defaultQuestions.ts`. `GET /api/questions` is public
and returns `options` parsed. Candidates pick changes up on next app
mount because `App.tsx` refetches and overwrites `exam_system_questions`.

**Triplication**: `seed.ts`, `defaultQuestions.ts`, and
`storage.ts INITIAL_QUESTIONS` must stay identical. See
[guides/05_how_to_change_questions.md](../guides/05_how_to_change_questions.md).

## Settings

Single row `ExamSetting` id `default-settings`: `examTitle`,
`durationMinutes`, `passingPercentage`, `sectorBadge`,
`allowReviewAnswers`, `notifyEmail`. `GET /api/settings` public (creates
the row if missing), `PUT` admin. Stored client-side as
`exam_system_settings`; every screen reads through
`ExamStorage.getSettings()`.

## Files

`backend/src/routes/questionRoutes.ts`, `settingRoutes.ts`,
`backend/src/config/defaultQuestions.ts`, `backend/prisma/seed.ts`,
`frontend/src/pages/AdminDashboard.tsx` (exams tab),
`frontend/src/services/storage.ts`.

## Known gaps

- `POST /api/questions` picks `max(id)+1` non-atomically — `TODO.md` §Correctness.
- Collapse triplication — `TODO.md` §Later.
