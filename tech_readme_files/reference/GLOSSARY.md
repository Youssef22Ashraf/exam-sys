> [INDEX](../INDEX.md) > Glossary

# Glossary

| Term | Meaning here |
|---|---|
| Candidate | Person sitting the exam. Identified by email + company ID, no account. |
| Company ID | Employer-issued employee number typed at registration. Part of lockout identity. |
| Attempt | One `ExamAttempt` row. `attemptNumber` counts per candidate. |
| Cooldown / lockout | 48-hour wait after `submittedAt` before the same identity may register again. |
| Part A / Part B | Interface Management (q1–20, 31–33) / Stakeholder Management (q21–30, 34–40). |
| Pass mark | `ExamSetting.passingPercentage`, default 70. |
| Proctoring status | `Verified` (0 tab switches), `Warnings` (>0), `Camera Disabled` (declared, unused). |
| Tab switch | `visibilitychange`/`blur` event counted during the exam. Self-reported. |
| Snapshot | JPEG from the webcam canvas at submit. |
| Recording | Whole-session `.webm` from MediaRecorder, uploaded at submit. |
| Fallback path | `api.ts` catching a network error and using `ExamStorage`. Not synced later. |
| Reset (questions) | `POST /api/questions/reset` — reload from `defaultQuestions.ts`. |
| Gate | `tsc --noEmit` (backend) + `lint` + `tsc -b` (frontend). |
| Supervisor / admin | Holder of the seeded `AdminUser`. Uses `/admin`. |
| ADR | Architecture Decision Record, `tech_readme_files/decisions/`. |
