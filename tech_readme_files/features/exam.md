> [INDEX](../INDEX.md) > [Features](README.md) > Exam

# Exam

Timed, 40 questions, two parts, one question on screen with a grid to
jump around, flag-for-review, and auto-submit when the timer hits zero.

## Behaviour

- **Questions and duration** come from `ExamStorage.getQuestions()` /
  `getSettings()`, which `App.tsx` refreshed from the API on mount.
  Nothing is hardcoded; `EXAM_DURATION = durationMinutes * 60`.
- **Progress persistence**: answers, flags, current index, time left, and
  tab-switch count are written to `sessionStorage` under
  `exam_session_<email>` on every change. A reload resumes. The key is
  removed on submit.
- **Anti-copy**: `copy`, `cut`, `paste`, and `contextmenu` events are
  prevented while the exam is mounted. `beforeunload` warns.
- **Tab audit**: `visibilitychange` / `blur` increments `tabSwitches`,
  emits `candidate:warning` over Socket.io, and shows an in-exam warning.
- **Submit**: builds `answers` (`questionId → optionIndex`), computes a
  local preview, calls `releaseCamera()`, grabs the snapshot from
  `CameraProctor`, uploads the video, then `POST /api/exam/submit`.
  Server result wins (see [results.md](results.md)).

## Files

| File | Role |
|---|---|
| `frontend/src/pages/Exam.tsx` / `Exam.css` | everything above |
| `frontend/src/components/CameraProctor.tsx` | mounted inside the exam, see [proctoring.md](proctoring.md) |
| `frontend/src/services/socket.ts` | `emitCandidateStarted`, `emitCandidateWarning`, `emitExamSubmitted` |
| `frontend/src/services/camera.ts` | `releaseCamera()` |

## Known gaps

- Fixed question and option order — `TODO.md` §Later.
- `correctAnswer` is present in the client question payload.
