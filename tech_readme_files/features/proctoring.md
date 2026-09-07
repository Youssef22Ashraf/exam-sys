> [INDEX](../INDEX.md) > [Features](README.md) > Proctoring

# Proctoring

Webcam on for the whole exam, full-session recording, snapshot at submit,
tab-switch counting, and live events to the admin dashboard.

## Recording pipeline

`CameraProctor` → `getUserMedia({video, audio})` → `MediaRecorder`
(`video/webm;codecs=vp8`, fallback to default) → each chunk into IndexedDB
(`services/videoStorage.ts`) → on submit, concatenate → `FormData` →
`POST /api/proctor/upload-video` (multer disk storage,
`backend/uploads/videos/`, 200 MB cap) → filename stored on the attempt as
`videoFilename`, `hasVideoRecording = true`. Snapshot: canvas
`toDataURL("image/jpeg")` → `POST /api/proctor/upload-snapshot` (10 MB cap).
Rationale: [ADR 006](../decisions/006-webcam-recording-indexeddb-then-upload.md).

## Playback

Admin streams `GET /api/proctor/video/:filename` with `Range` support;
`download/:filename` sends it as an attachment.

## Status derivation

`proctoringStatus` = `Verified` when `tabSwitches === 0`, else `Warnings`.
`Camera Disabled` is in the type union but no code path sets it yet.

## Live events

| Client emits | Server rebroadcasts | Payload |
|---|---|---|
| `candidate:started` | `admin:candidate_started` | name, email, companyId |
| `candidate:warning` | `admin:candidate_warning` | + reason, tabSwitches |
| `candidate:submitted` | `admin:exam_submitted` | + score, percentage, isPassed |

Server adds `timestamp`. Handlers live in `backend/src/index.ts`.

## Camera release

Every exit path calls `releaseCamera()` (stops every track on the shared
stream). Regressions here are the most common bug class in the history —
three fix commits on 2026-09-06.

## Files

`frontend/src/components/CameraProctor.tsx`, `CameraProctor.css`,
`frontend/src/services/camera.ts`, `videoStorage.ts`, `socket.ts`,
`backend/src/routes/proctorRoutes.ts`, `backend/src/index.ts` (sockets).

## Known gaps

- Video endpoints are public — `TODO.md` §Security item 1.
- No retention policy — `TODO.md` §Later.
- Safari/Firefox MediaRecorder untested — `CURRENT_STATUS.md`.
