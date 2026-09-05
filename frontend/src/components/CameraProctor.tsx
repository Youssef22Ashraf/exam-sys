import { useEffect, useRef, useState, useCallback } from "react";
import "./CameraProctor.css";

interface CameraProctorProps {
  candidateName?: string;
  candidateId?: string;
  onWarningChange?: (warningsCount: number) => void;
  onRegisterSnapshotGetter?: (getSnapshotFn: () => string | null) => void;
  onRegisterStopRecording?: (stopFn: () => Promise<Blob | null>) => void;
}

export function CameraProctor({
  candidateName,
  candidateId,
  onWarningChange,
  onRegisterSnapshotGetter,
  onRegisterStopRecording,
}: CameraProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
        setIsSimulated(false);

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

  useEffect(() => {
    startCamera();

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
    };
  }, [startCamera]);

  // Stop recording handler
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state === "inactive"
      ) {
        if (recordedChunksRef.current.length > 0) {
          resolve(new Blob(recordedChunksRef.current, { type: "video/webm" }));
        } else {
          resolve(null);
        }
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        resolve(blob);
      };

      try {
        mediaRecorderRef.current.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

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
        return newCount;
      });

      setActiveAlert(`⚠️ Proctor Alert: ${reason}! Event recorded.`);
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
  }, [onWarningChange]);

  // Snapshot capture function
  const captureSnapshot = useCallback((): string | null => {
    if (isSimulated) {
      // Return a simulated candidate avatar canvas
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(160, 100, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(160, 240, 90, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(candidateName || "Candidate", 160, 215);
        ctx.font = "10px monospace";
        ctx.fillText(`ID: ${candidateId || "N/A"} • Verified`, 160, 230);
      }
      return canvas.toDataURL("image/jpeg", 0.8);
    }

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
  }, [candidateName, candidateId, hasPermission, isSimulated]);

  // Register snapshot getter to parent
  useEffect(() => {
    if (onRegisterSnapshotGetter) {
      onRegisterSnapshotGetter(captureSnapshot);
    }
  }, [onRegisterSnapshotGetter, captureSnapshot]);

  function enableSimulatedCamera() {
    setIsSimulated(true);
    setHasPermission(true);
  }

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
            {hasPermission
              ? isSimulated
                ? "Simulated"
                : isRecording
                ? "Recording"
                : "Active"
              : "Camera Off"}
          </span>
        </div>

        <div className="proctor-video-wrapper">
          {hasPermission && !isSimulated && (
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

          {hasPermission && isSimulated && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                color: "#94a3b8",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                👤
              </div>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                Proctoring Verified (Simulation)
              </span>
            </div>
          )}

          {!hasPermission && (
            <div className="proctor-fallback-box">
              <span className="fallback-icon">📷</span>
              <p>Camera feed is not connected or permission was not granted.</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="proctor-retry-btn"
                  onClick={startCamera}
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  className="proctor-retry-btn"
                  onClick={enableSimulatedCamera}
                >
                  Use Simulation
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="proctor-footer">
          <span>{isRecording ? "🎥 Video Recorded" : "Integrity Guard: ON"}</span>
          <span
            className={`warning-counter ${
              warningsCount > 0 ? "has-warnings" : ""
            }`}
          >
            {warningsCount === 0
              ? "✓ 0 Warnings"
              : `⚠️ ${warningsCount} Tab Switch${warningsCount === 1 ? "" : "es"}`}
          </span>
        </div>
      </div>
    </>
  );
}

export default CameraProctor;
