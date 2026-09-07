> [INDEX](../INDEX.md) > [Features](README.md) > Email alerts

# Email alerts

Every successful `POST /api/exam/submit` sends one HTML email.

## Transport

`createTransporter()` in `backend/src/services/emailService.ts` builds a
nodemailer SMTP transport only when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
are all set; port 465 → `secure:true`, anything else STARTTLS.
`tls.rejectUnauthorized:false` is set for Office 365 compatibility — this
disables certificate verification and should be revisited. Without SMTP
env the function logs and returns; submit still succeeds.

## Recipients

`ExamSetting.notifyEmail` (comma/semicolon separated, parsed by
`parseRecipients`) wins; else `ADMIN_ALERT_EMAIL`; else a hardcoded
fallback address that should be removed.

## Content

Candidate details, score, percentage, verdict, duration, `tabSwitches`,
`proctoringStatus`. Attempts > 1 get `[RE-ATTEMPT #N]` in the subject and
an amber banner listing the earlier attempts.

## Test

`POST /api/settings/test-email` (`sendTestEmailAlert`) and the "Send test"
button in the admin exams tab.

## Known gaps

- `test-email` is unauthenticated — `TODO.md` §Security item 1.
- ~~Hardcoded fallback recipient in `emailService.ts`.~~ Closed: falls back to
`ADMIN_ALERT_EMAIL` only; an unset recipient skips the send with a warning.
