import { useState, useEffect, useRef, useCallback } from "react";
import { ExamStorage } from "../services/storage";
import { Icon } from "../components/Icon";
import { registerActiveCameraStream, releaseCamera } from "../services/camera";
import "./ExamInstructions.css";

interface ExamInstructionsProps {
  onStart: () => void;
  candidateName?: string;
}

function ExamInstructions({ onStart, candidateName }: ExamInstructionsProps) {
  const settings = ExamStorage.getSettings();
  const questions = ExamStorage.getQuestions();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isMediaSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const [cameraState, setCameraState] = useState<"checking" | "ready" | "denied" | "unsupported">(
    isMediaSupported ? "checking" : "unsupported"
  );
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(
    isMediaSupported ? null : "Your browser does not support media device recording. Please use modern Google Chrome, Microsoft Edge, or Firefox."
  );

  // Mandatory Rules Checklist States
  const [checkedCamera, setCheckedCamera] = useState(false);
  const [checkedTabs, setCheckedTabs] = useState(false);
  const [checkedIntegrity, setCheckedIntegrity] = useState(false);

  // Ensure live video stream is bound to DOM element
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch((err) => {
        console.warn("Video play notice:", err);
      });
    }
  }, []);

  // Request camera stream for preview verification
  const requestCamera = useCallback(async () => {
    if (!isMediaSupported) {
      setCameraState("unsupported");
      setCameraErrorMsg("Your browser does not support media device recording. Please use modern Google Chrome, Microsoft Edge, or Firefox.");
      return;
    }

    setCameraState("checking");
    setCameraErrorMsg(null);

    try {
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
        videoRef.current.play().catch(() => {});
      }
      setCameraState("ready");
    } catch (err: unknown) {
      console.warn("Camera preview initialization error:", err);
      setCameraState("denied");
      const errorName = err instanceof Error ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setCameraErrorMsg("Camera access was denied by your browser. Please click the camera icon in your address bar to allow permissions, then click 'Retry Camera'.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setCameraErrorMsg("No camera device was detected. Please plug in or enable a webcam to proceed.");
      } else {
        setCameraErrorMsg("Unable to access camera hardware. Please check your system camera privacy settings.");
      }
    }
  }, [isMediaSupported]);

  useEffect(() => {
    if (!isMediaSupported) return;

    let isMounted = true;

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" },
        audio: false,
      })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        registerActiveCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraState("ready");
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setCameraState("denied");
        const errorName = err instanceof Error ? err.name : "";
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraErrorMsg("Camera access was denied by your browser. Please click the camera icon in your address bar to allow permissions, then click 'Retry Camera'.");
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraErrorMsg("No camera device was detected. Please plug in or enable a webcam to proceed.");
        } else {
          setCameraErrorMsg("Unable to access camera hardware. Please check your system camera privacy settings.");
        }
      });

    return () => {
      isMounted = false;
      // Clean up preview stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      releaseCamera();
    };
  }, [isMediaSupported]);

  // Keep video element synced whenever camera reaches ready state
  useEffect(() => {
    if (cameraState === "ready" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((err) => {
        console.warn("Video play error:", err);
      });
    }
  }, [cameraState]);

  // Handle starting exam: release preview stream first so CameraProctor takes over cleanly
  const handleProceedToExam = () => {
    if (cameraState !== "ready" || !checkedCamera || !checkedTabs || !checkedIntegrity) {
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    releaseCamera();

    onStart();
  };

  const isFormComplete = cameraState === "ready" && checkedCamera && checkedTabs && checkedIntegrity;

  return (
    <main className="page-container">
      <div style={{ textAlign: "center" }}>
        <div
          className="company-logo-badge"
          style={{
            height: "56px",
            padding: "6px 16px",
            margin: "0 auto 14px auto",
            borderRadius: "10px",
          }}
          title="Mofarreh Group — Engineering & Construction"
        >
          <img
            src="/mofarreh-logo.png"
            alt="Mofarreh Group Logo"
            style={{ height: "42px", width: "auto" }}
          />
        </div>
        <h1 className="page-title">Examination Instructions & Proctor Verification</h1>

        <p className="page-description">
          {candidateName ? `Welcome, ${candidateName}. ` : ""}
          Please review the proctoring rules, verify your camera footage, and complete the compliance checklist below.
        </p>
      </div>

      <div className="instructions-card">
        {/* Anti-Cheating Alert Banner */}
        <div className="rules-alert-banner">
          <div className="rules-alert-title">
            <Icon name="alert-triangle" size={18} />
            <span>Strict Anti-Cheating & Proctoring Protocol</span>
          </div>
          <div className="rules-alert-body">
            This examination is conducted under <strong>live automated webcam proctoring</strong> and <strong>browser tab auditing</strong>. All tab switches, window minimization, or attempts to navigate away from the test are recorded in real-time and reported directly to supervisors.
          </div>
        </div>

        <div className="instructions-grid">
          {/* Left Column: Exam Rules & Details */}
          <div>
            <div className="section-header">
              <Icon name="file-text" size={18} />
              <span>Assessment Rules & Structure</span>
            </div>

            <div className="instruction-item">
              <span className="instruction-num">01</span>
              <div className="instruction-text">
                <strong>Question Scope:</strong> Contains <b>{questions.length} questions</b> divided into Part A (Interface Management) and Part B (Stakeholder Management).
              </div>
            </div>

            <div className="instruction-item">
              <span className="instruction-num">02</span>
              <div className="instruction-text">
                <strong>Duration & Pass Mark:</strong> You have <b>{settings.durationMinutes} minutes</b> to finish. Passing grade is <b>{settings.passingPercentage}%</b>.
              </div>
            </div>

            <div className="instruction-item">
              <span className="instruction-num">03</span>
              <div className="instruction-text">
                <strong>Tab Switching Auditing:</strong> Close all other browser tabs, devtools, and background messaging apps. Tab switches increment your warning tally and appear on supervisor reports.
              </div>
            </div>

            <div className="instruction-item">
              <span className="instruction-num">04</span>
              <div className="instruction-text">
                <strong>Mandatory Camera Footage:</strong> Your webcam must record continuously with your face fully visible. Sessions submitted with a blank/covered camera or missing footage are flagged as invalid.
              </div>
            </div>

            <div className="instruction-item">
              <span className="instruction-num">05</span>
              <div className="instruction-text">
                <strong>Uninterrupted Session:</strong> The exam timer cannot be paused once started. The assessment automatically submits when the countdown expires.
              </div>
            </div>
          </div>

          {/* Right Column: Live Camera Preview & Checklist */}
          <div>
            <div className="section-header">
              <Icon name="camera" size={18} />
              <span>Webcam Readiness Check</span>
            </div>

            <div className="camera-preview-wrapper">
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
                className="camera-preview-video"
                style={{ display: cameraState === "ready" ? "block" : "none" }}
              />

              {cameraState === "ready" && (
                <>
                  <div className="camera-face-guide" />
                  <div className="camera-status-overlay camera-status-ready">
                    <span className="camera-status-dot" />
                    <span>Live Camera Active</span>
                  </div>
                </>
              )}

              {cameraState === "checking" && (
                <div className="camera-error-container">
                  <div className="camera-status-overlay camera-status-checking">
                    <span className="camera-status-dot" />
                    <span>Connecting Camera...</span>
                  </div>
                  <p>Requesting camera permission from your browser...</p>
                </div>
              )}

              {(cameraState === "denied" || cameraState === "unsupported") && (
                <div className="camera-error-container">
                  <div className="camera-status-overlay camera-status-denied">
                    <Icon name="x" size={12} />
                    <span>Camera Required</span>
                  </div>
                  <p>{cameraErrorMsg || "Camera access is required for proctored examination."}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: "12px", padding: "8px 16px" }}
                    onClick={requestCamera}
                  >
                    Retry Camera Access
                  </button>
                </div>
              )}
            </div>

            {/* Compliance Checklist */}
            <div className="checklist-section">
              <div className="section-header" style={{ marginTop: "16px" }}>
                <Icon name="shield" size={18} />
                <span>Candidate Rules Verification</span>
              </div>

              <label className={`checklist-item ${checkedCamera ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="checklist-checkbox"
                  checked={checkedCamera}
                  disabled={cameraState !== "ready"}
                  onChange={(e) => setCheckedCamera(e.target.checked)}
                />
                <div className="checklist-label">
                  <strong>1. Camera Active & Visible</strong>
                  I verify that my webcam is active and my face is clearly centered in the live preview box.
                </div>
              </label>

              <label className={`checklist-item ${checkedTabs ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="checklist-checkbox"
                  checked={checkedTabs}
                  onChange={(e) => setCheckedTabs(e.target.checked)}
                />
                <div className="checklist-label">
                  <strong>2. All Other Tabs Closed</strong>
                  I have closed all other browser tabs and apps. I understand that tab switching is audited and logged in real-time.
                </div>
              </label>

              <label className={`checklist-item ${checkedIntegrity ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="checklist-checkbox"
                  checked={checkedIntegrity}
                  onChange={(e) => setCheckedIntegrity(e.target.checked)}
                />
                <div className="checklist-label">
                  <strong>3. Video Footage Policy Acknowledged</strong>
                  I acknowledge that submitting an assessment with missing/blank video footage or attempting to bypass proctoring will disqualify my submission.
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Gated Action Bar */}
        <div className="instructions-action-bar">
          {!isFormComplete && (
            <div className="action-status-hint warning">
              <Icon name="alert-triangle" size={15} />
              {cameraState !== "ready"
                ? "Please enable camera access before taking the assessment."
                : "Please review and check all 3 compliance boxes above to unlock the exam."}
            </div>
          )}

          {isFormComplete && (
            <div className="action-status-hint ready">
              <Icon name="check" size={15} />
              All requirements verified. You are authorized to begin your sitting.
            </div>
          )}

          <button
            type="button"
            className="primary-button start-exam-button"
            disabled={!isFormComplete}
            onClick={handleProceedToExam}
          >
            {isFormComplete ? "Start Examination →" : "Complete Requirements to Start"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default ExamInstructions;