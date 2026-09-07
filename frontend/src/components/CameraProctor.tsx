import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "./Icon";
import { socketService } from "../services/socket";
import { registerActiveCameraStream, releaseCamera } from "../services/camera";
import "./CameraProctor.css";

interface CameraProctorProps {
  candidateName?: string;
  candidateId?: string;
  /** Server-owned sitting; warnings are banked against it. */
  sessionId?: string;
  onWarningChange?: (warningsCount: number) => void;
  onRegisterSnapshotGetter?: (getSnapshotFn: () => string | null) => void;
  onRegisterStopRecording?: (stopFn: () => Promise<Blob | null>) => void;
}

export function CameraProctor({
  candidateName,
  candidateId,
  sessionId,
  onWarningChange,
  onRegisterSnapshotGetter,
  onRegisterStopRecording,
}: CameraProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [warningsCount, setWarningsCount] = useState(0);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Initialize camera & background recording
  const startCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480 },
            height: { ideal: 360 },
            facingMode: "user",
          },
          audio: false,
        });

        streamRef.current = stream;
        registerActiveCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);

        // Start background media recording
        try {
          recordedChunksRef.current = [];
          let mimeType = "video/webm;codecs=vp8";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "video/webm";
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // use browser default
          }

          const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          recorder.start(1000); // 1-second chunks
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
        } catch (recorderErr) {
          console.warn("MediaRecorder not supported or failed to start:", recorderErr);
        }
      } else {
        setHasPermission(false);
      }
    } catch (err) {
      console.warn("Camera access not granted or not available:", err);
      setHasPermission(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    // 1. Stop recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    // 2. Stop all camera media tracks immediately
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {}
      streamRef.current = null;
    }
    // 3. Clear video element source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // 4. Global safety release
    releaseCamera();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    startCamera();

    const handleWindowUnload = () => {
      stopCamera();
    };

    window.addEventListener("beforeunload", handleWindowUnload);
    window.addEventListener("pagehide", handleWindowUnload);
    window.addEventListener("unload", handleWindowUnload);

    return () => {
      // Clean up recorder
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      // Clean up media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      window.removeEventListener("beforeunload", handleWindowUnload);
      window.removeEventListener("pagehide", handleWindowUnload);
      window.removeEventListener("unload", handleWindowUnload);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Stop recording handler
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state === "inactive"
      ) {
        const resultBlob =
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "video/webm" })
            : null;
        stopCamera();
        resolve(resultBlob);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        stopCamera();
        resolve(blob);
      };

      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopCamera();
        resolve(null);
      }
    });
  }, [stopCamera]);

  // Register stop recording getter
  useEffect(() => {
    if (onRegisterStopRecording) {
      onRegisterStopRecording(stopRecording);
    }
  }, [onRegisterStopRecording, stopRecording]);

  // Anti-cheat: tab switch & focus loss detection
  useEffect(() => {
    function handleSecurityBreach(reason: string) {
      setWarningsCount((prev) => {
        const newCount = prev + 1;
        if (onWarningChange) {
          onWarningChange(newCount);
        }
        socketService.emitCandidateWarning({
          candidateName: candidateName || "Candidate",
          candidateEmail: candidateId || "N/A",
          companyId: candidateId || "N/A",
          warningType: reason,
          totalWarnings: newCount,
          sessionId,
        });
        return newCount;
      });

      setActiveAlert(`Proctor Alert: ${reason}! Event recorded.`);
      setTimeout(() => {
        setActiveAlert(null);
      }, 4000);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        handleSecurityBreach("Tab switch or browser minimized");
      }
    }

    function onWindowBlur() {
      handleSecurityBreach("Assessment window lost focus");
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [onWarningChange, candidateName, candidateId, sessionId]);

  // Snapshot capture function
  const captureSnapshot = useCallback((): string | null => {
    if (!videoRef.current || !hasPermission) {
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw mirrored image
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Stamp metadata
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(
          `${candidateName || "Candidate"} (${candidateId || "ID"}) - ${new Date().toLocaleTimeString()}`,
          10,
          canvas.height - 10
        );
        return canvas.toDataURL("image/jpeg", 0.85);
      }
    } catch (e) {
      console.error("Failed to capture snapshot:", e);
    }
    return null;
  }, [hasPermission]);

  // Register snapshot getter to parent
  useEffect(() => {
    if (onRegisterSnapshotGetter) {
      onRegisterSnapshotGetter(captureSnapshot);
    }
  }, [onRegisterSnapshotGetter, captureSnapshot]);

  return (
    <>
      {/* Toast Alert on tab switch */}
      {activeAlert && (
        <div className="security-alert-toast">
          <span>{activeAlert}</span>
        </div>
      )}

      <div className="proctor-card">
        <div className="proctor-header">
          <div className="proctor-title-group">
            <span
              className={`recording-dot ${
                warningsCount > 0 ? "warning" : !hasPermission ? "offline" : ""
              }`}
            />
            <span className="proctor-title">Live Proctoring</span>
          </div>

          <span
            className={`proctor-badge ${
              warningsCount > 0 ? "warn" : hasPermission ? "active" : ""
            }`}
          >
            {hasPermission ? (isRecording ? "Recording" : "Active") : "Camera Off"}
          </span>
        </div>

        <div className="proctor-video-wrapper">
          {hasPermission && (
            <>
              <video
                ref={videoRef}
                className="proctor-video"
                autoPlay
                playsInline
                muted
              />
              <div className="face-target-guide" />
              <div className="proctor-overlay-meta">
                <span>● {isRecording ? "REC (Video)" : "LIVE"}</span>
                <span>{candidateId ? `ID: ${candidateId}` : "SECURE"}</span>
              </div>
            </>
          )}

          {!hasPermission && (
            <div className="proctor-fallback-box">
              <span className="fallback-icon"><Icon name="camera" size={36} /></span>
              <p>Camera feed is not connected or permission was not granted.</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="proctor-retry-btn"
                  onClick={startCamera}
                >
                  Retry Camera
                </button>
              </div>
              <p className="proctor-fallback-note">
                The assessment is recorded. Without a camera this attempt is
                filed as <strong>Camera Disabled</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="proctor-footer">
          <span>{isRecording ? <><Icon name="video" /> Video Recorded</> : "Integrity Guard: ON"}</span>
          <span
            className={`warning-counter ${
              warningsCount > 0 ? "has-warnings" : ""
            }`}
          >
            {warningsCount === 0
              ? <><Icon name="check" /> 0 Warnings</>
                : <><Icon name="alert-triangle" /> {warningsCount} Tab Switch{warningsCount === 1 ? "" : "es"}</>}
          </span>
        </div>
      </div>
    </>
  );
}

export default CameraProctor;
