> [INDEX](../INDEX.md) > Features

# Feature Docs

One document per user-facing feature. Each covers: what it does, the
screens and files, the API calls, the client state it touches, and what
is known to be missing. English only — this product has no Arabic UI.

| Feature | Doc | What it covers |
|---|---|---|
| Registration & lockout | [registration-and-lockout.md](registration-and-lockout.md) | Candidate identity, 48-hour cooldown check, countdown |
| Exam | [exam.md](exam.md) | Timer, question grid, flagging, refresh protection, anti-copy, auto-submit |
| Proctoring | [proctoring.md](proctoring.md) | Webcam recording, snapshot, tab-switch audit, live socket events |
| Results | [results.md](results.md) | Server scoring, certificate screen, attempt number |
| Admin dashboard | [admin-dashboard.md](admin-dashboard.md) | Hidden `/admin`, login, overview, candidates, results, video review, CSV |
| Question bank & settings | [question-bank-and-settings.md](question-bank-and-settings.md) | CRUD, reset, duration, pass mark, recipients |
| Email alerts | [email-alerts.md](email-alerts.md) | SMTP transport, completion mail, re-attempt banner, test button |

## Conventions

- Copy `exam.md` as the starting shape for a new feature doc.
- "Files" tables list every file the feature touches so a change can be
  traced. "Known gaps" links to the `TODO.md` item, never restates it.
