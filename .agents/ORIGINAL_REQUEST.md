# Original User Request

> Reconstructed 2026-09-07 from the client's question sheets
> (`interface questions.txt`, `stakeholder questions.txt`), the UI
> reference screenshots in `ref-for ui/`, and the commit history
> 2026-09-04 → 2026-09-07. The client never wrote a single brief; this is
> the brief the code answers to. Amend it if the client corrects it.

## Initial Request — 2026-09-04

Build a web-based exam that a workplace can use to certify that a person
understands two procedures before they are given site or operational
access: **Interface Management** (Part A, 20 questions + 3 true/false)
and **Stakeholder Management** (Part B, 10 questions + 7 true/false).
Questions and answers are supplied in two text files. The UI should look
like the reference screenshots.

Working directory: /Volumes/files/projects/exam-sys

## Requirements

### R1. Candidate exam
Register with name, company employee ID, and email. Read instructions.
Sit a timed exam (default 30 minutes) with a question grid, flagging, and
auto-submit on expiry. See the result immediately: score, percentage,
Part A / Part B split, pass or fail at the configured threshold
(default 70%).

### R2. Anti-cheating
Webcam must be on for the whole exam and the recording kept for review.
Count and report tab switches / window blur. Block copy and paste.
A supervisor must be able to watch sessions live.

### R3. Retest policy
A candidate who has completed the exam may not sit it again for 48 hours,
identified by email or company ID. Show them when they can retry. A
supervisor can override.

### R4. Admin portal
Hidden from candidates. Supervisors log in, see every attempt with scores,
timestamps, integrity flags, the answer sheet, and the recording. They can
edit questions, change duration and pass mark, and export everything to
Excel.

### R5. Notifications
Email the supervisors when an exam is finished, with the result and
whether it was a re-attempt.

### R6. Deployment
Runs from one URL on Railway with a Dockerfile. Recordings and the
database survive redeploys.

## Acceptance Criteria

- [x] Candidate can complete the full flow end to end on a laptop with a webcam.
- [x] Score is computed on the server, not in the browser.
- [x] Recording is viewable in admin after submit.
- [x] Second attempt inside 48 h is blocked at registration with a countdown.
- [x] Admin can change the pass mark and see it reflected on the next result.
- [x] Email arrives on submit when SMTP is configured.
- [x] `docker build` at repo root produces a runnable image.
- [ ] Any automated test exists.
- [ ] Candidate data is not readable without an admin token.
