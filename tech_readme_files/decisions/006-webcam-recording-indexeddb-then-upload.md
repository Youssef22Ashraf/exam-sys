# ADR 006 — Buffer the webcam recording in IndexedDB, upload one `.webm` on submit

## Status
Accepted (2026-09-06)

## Context
A 30-minute webcam recording is tens of megabytes. Streaming chunks to
the server during the exam would need a chunked upload endpoint, retry
logic, and a reassembly step. Holding the whole thing in memory risks a
tab crash on low-RAM laptops.

## Decision
`CameraProctor` starts a `MediaRecorder` (`video/webm;codecs=vp8`, falling
back to browser default) and writes each `ondataavailable` blob to
IndexedDB via `services/videoStorage.ts`. On submit the chunks are
concatenated into one Blob and `POST`ed to `/api/proctor/upload-video`
(multer, 200 MB cap). A JPEG snapshot goes to `upload-snapshot`
separately.

## Consequences
- One upload, one file per attempt, simple admin playback with range
  requests.
- If the tab is closed before submit, the recording is lost. Accepted:
  a closed tab is itself a proctoring flag.
- `.webm` only. Safari's MediaRecorder output is untested
  (`CURRENT_STATUS.md`).
