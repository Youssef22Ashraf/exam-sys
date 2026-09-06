/**
 * Global Camera Stream Manager
 * Ensures all webcam and microphone tracks are immediately stopped and hardware released
 * whenever an exam is submitted, finished, closed, or navigated away from.
 */

let activeCameraStream: MediaStream | null = null;

export function registerActiveCameraStream(stream: MediaStream | null) {
  activeCameraStream = stream;
}

export function releaseCamera() {
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
    } catch {}
    activeCameraStream = null;
  }
}

// Window-level safety hook: release camera on tab close, reload, or navigate
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", releaseCamera);
  window.addEventListener("pagehide", releaseCamera);
  window.addEventListener("unload", releaseCamera);
}

