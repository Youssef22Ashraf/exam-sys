import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Icon } from "../components/Icon";
import { CompanyLogo } from "../components/CompanyLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../services/api";
import { type LectureItem } from "../services/storage";
import { type LectureUserData } from "./LecturesLogin";
import "./LecturesPortal.css";

interface LecturesPortalProps {
  user: LectureUserData;
  onStartExam: () => void;
  onExit: () => void;
}

export default function LecturesPortal({ user, onStartExam, onExit }: LecturesPortalProps) {
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("interface-management");
  const [selectedLecture, setSelectedLecture] = useState<LectureItem | null>(null);
  const [loading, setLoading] = useState(true);

  // View modes: "video" | "slides" | "checklist"
  const [viewMode, setViewMode] = useState<"video" | "slides" | "checklist">("video");

  // Slide Viewer state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSlideFullscreen, setIsSlideFullscreen] = useState(false);

  // Video playback & Heartbeat state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [maxPercent, setMaxPercent] = useState(0);
  const lastHeartbeatTime = useRef<number>(0);
  const currentAttendanceId = useRef<string | undefined>(user.attendanceId);

  // Checklist & Progress state: Map of lectureId -> completed item IDs
  const [userProgressMap, setUserProgressMap] = useState<Record<string, { completedItems: string[]; percent: number }>>({});
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Fetch all lectures and user's saved progress on mount
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getLectures(),
      api.getUserLectureProgress(user.email),
    ]).then(([list, progRes]) => {
      if (!mounted) return;
      if (list && list.length > 0) {
        setLectures(list);
        setSelectedId(list[0].id);
      }
      if (progRes && progRes.progress) {
        const pMap: Record<string, { completedItems: string[]; percent: number }> = {};
        for (const p of progRes.progress) {
          let items: string[];
          try {
            items = JSON.parse(p.completedItems);
          } catch {
            items = [];
          }
          pMap[p.lectureId] = {
            completedItems: items,
            percent: Math.round(p.completionPercent || 0),
          };
        }
        setUserProgressMap(pMap);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [user.email]);

  // Fetch full details of selected lecture
  useEffect(() => {
    let mounted = true;
    if (!selectedId) return;

    api.getLectureDetails(selectedId).then((lec) => {
      if (!mounted) return;
      setSelectedLecture(lec);
      setCurrentSlideIndex(0);
      setWatchSeconds(0);
      setMaxPercent(0);
      lastHeartbeatTime.current = 0;

      // Log lecture selection
      api.recordLectureAccess({
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        department: user.department,
        lectureId: selectedId,
        action: "LECTURE_VIEWED",
      }).then((res) => {
        if (res.attendanceId) {
          currentAttendanceId.current = res.attendanceId;
        }
      });
    });

    return () => {
      mounted = false;
    };
  }, [selectedId, user]);

  // Current lecture's completed items
  const currentCompletedItems = useMemo(
    () => userProgressMap[selectedId]?.completedItems || [],
    [userProgressMap, selectedId]
  );
  const currentCompletionPercent = userProgressMap[selectedId]?.percent || 0;

  // Calculate overall course progress (average percent across all lectures)
  const totalLecturesCount = lectures.length || 4;
  const overallProgressSum = lectures.reduce((acc, lec) => {
    return acc + (userProgressMap[lec.id]?.percent || 0);
  }, 0);
  const overallCoursePercent = Math.round(overallProgressSum / (totalLecturesCount || 1));

  // Toggle or update checklist item
  const updateChecklistItem = useCallback(
    async (itemId: string, forceState?: boolean) => {
      if (!selectedLecture) return;
      const currentItems = userProgressMap[selectedLecture.id]?.completedItems || [];
      const isCurrentlyChecked = currentItems.includes(itemId);
      const shouldCheck = forceState !== undefined ? forceState : !isCurrentlyChecked;

      let newItems: string[];
      if (shouldCheck) {
        newItems = isCurrentlyChecked ? currentItems : [...currentItems, itemId];
      } else {
        newItems = currentItems.filter((id) => id !== itemId);
      }

      setSavingChecklist(true);
      try {
        const res = await api.updateLectureChecklist({
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          department: user.department,
          lectureId: selectedLecture.id,
          completedItems: newItems,
          action: "CHECKLIST_UPDATED",
        });

        const newPercent = res.completionPercent ?? currentCompletionPercent;
        setUserProgressMap((prev) => ({
          ...prev,
          [selectedLecture.id]: {
            completedItems: newItems,
            percent: newPercent,
          },
        }));
      } catch (err) {
        console.warn("Could not sync checklist:", err);
      } finally {
        setSavingChecklist(false);
      }
    },
    [selectedLecture, userProgressMap, currentCompletionPercent, user]
  );

  // Periodic watch progress tracking
  const sendProgressHeartbeat = useCallback(
    (action = "VIDEO_WATCHED") => {
      if (!videoRef.current || !selectedLecture) return;
      const vid = videoRef.current;
      const duration = vid.duration || selectedLecture.durationSeconds || 1;
      const current = vid.currentTime || 0;
      const percent = Math.min(100, Math.round((current / duration) * 100));

      const updatedWatchSecs = Math.round(current);
      const updatedMaxPercent = Math.max(maxPercent, percent);
      setWatchSeconds(updatedWatchSecs);
      setMaxPercent(updatedMaxPercent);

      api.trackLectureProgress({
        attendanceId: currentAttendanceId.current,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        department: user.department,
        lectureId: selectedLecture.id,
        action,
        watchDurationSeconds: updatedWatchSecs,
        maxProgressPercent: updatedMaxPercent,
      });

      // Auto-check video in checklist if >= 80%
      if (percent >= 80 && !currentCompletedItems.includes("video")) {
        updateChecklistItem("video", true);
      }
    },
    [selectedLecture, user, maxPercent, currentCompletedItems, updateChecklistItem]
  );

  // Video timeupdate handler
  function handleTimeUpdate() {
    if (!videoRef.current) return;
    const now = Math.floor(videoRef.current.currentTime);
    if (now > 0 && now - lastHeartbeatTime.current >= 10) {
      lastHeartbeatTime.current = now;
      sendProgressHeartbeat("VIDEO_WATCHED");
    }
  }

  function handleVideoEnded() {
    sendProgressHeartbeat("VIDEO_COMPLETED");
    updateChecklistItem("video", true);
  }

  function handleDownloadSlides() {
    if (!selectedLecture) return;
    const downloadUrl = api.getLectureSlidesUrl(selectedLecture.id, user);
    window.open(downloadUrl, "_blank");
    // Mark download as completed in checklist
    updateChecklistItem("download", true);
  }

  // Slide navigation handlers
  const totalSlides =
    selectedLecture?.slideImagesCount ||
    selectedLecture?.slides?.length ||
    selectedLecture?.slideCount ||
    0;

  const handleNextSlide = useCallback(() => {
    if (currentSlideIndex < totalSlides - 1) {
      const nextIdx = currentSlideIndex + 1;
      setCurrentSlideIndex(nextIdx);
      if (nextIdx === totalSlides - 1) {
        updateChecklistItem("slides", true);
      }
    }
  }, [currentSlideIndex, totalSlides, updateChecklistItem]);

  const handlePrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  }, [currentSlideIndex]);

  // Keyboard navigation for slides
  useEffect(() => {
    if (viewMode !== "slides") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") handleNextSlide();
      if (e.key === "ArrowLeft") handlePrevSlide();
      if (e.key === "Escape" && isSlideFullscreen) setIsSlideFullscreen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, handleNextSlide, handlePrevSlide, isSlideFullscreen]);

  return (
    <div className={`lectures-portal-wrapper ${isSlideFullscreen ? "fullscreen-mode" : ""}`}>
      {/* Top Banner Navigation */}
      <header className="lectures-portal-nav">
        <div className="portal-brand">
          <CompanyLogo height={32} />
          <div className="portal-title-block">
            <span className="portal-heading">E&C TRAINING & PROCEDURE PORTAL</span>
            <span className="portal-subheading">Engineering & Construction Sector Governance</span>
          </div>
        </div>

        {/* Overall Course Progress Banner in Nav */}
        <div className="portal-overall-meter" title={`Overall Course Progress: ${overallCoursePercent}%`}>
          <div className="meter-label-row">
            <span>Overall Course Progress</span>
            <strong>{overallCoursePercent}%</strong>
          </div>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{
                width: `${overallCoursePercent}%`,
                background: overallCoursePercent === 100 ? "#10b981" : "linear-gradient(90deg, #3b82f6, #06b6d4)",
              }}
            />
          </div>
        </div>

        <div className="portal-user-meta">
          <div className="user-profile-chip" title={user.email}>
            <div className="user-avatar-initial">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-details-text">
              <span className="user-name">{user.name}</span>
              <span className="user-meta-sub">
                {user.department} • {user.companyId}
              </span>
            </div>
          </div>

          <ThemeToggle />

          <button className="exam-cta-nav-button" onClick={onStartExam}>
            <Icon name="check" size={16} />
            <span>Take Assessment Exam →</span>
          </button>

          <button className="exit-portal-button" onClick={onExit} title="Exit to Home">
            <Icon name="x" size={16} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="lectures-main-layout">
        {/* Left Sidebar: Lecture Modules List */}
        <aside className="lectures-sidebar">
          <div className="sidebar-header">
            <h3>TRAINING MODULES ({lectures.length})</h3>
            <p>Select a briefing to watch and study.</p>
          </div>

          <div className="lecture-card-list">
            {lectures.map((lec) => {
              const isSelected = lec.id === selectedId;
              const lecPercent = userProgressMap[lec.id]?.percent || 0;
              const isDone = lecPercent === 100;

              return (
                <button
                  key={lec.id}
                  type="button"
                  className={`lecture-nav-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedId(lec.id)}
                >
                  <div className="lec-card-top-row">
                    <div className="lec-card-category-badge">{lec.category}</div>
                    <div className={`lec-progress-pill ${isDone ? "done" : lecPercent > 0 ? "active" : ""}`}>
                      {isDone ? (
                        <>
                          <Icon name="check" size={11} /> 100%
                        </>
                      ) : (
                        `${lecPercent}%`
                      )}
                    </div>
                  </div>

                  <h4 className="lec-card-title">{lec.title}</h4>

                  <div className="lec-card-meta-row">
                    <span className="lec-meta-item">
                      <Icon name="clock" size={13} />
                      {lec.durationFormatted}
                    </span>
                    <span className="lec-meta-item">
                      <Icon name="file-text" size={13} />
                      {lec.slideCount} slides
                    </span>
                    {lec.hasSubtitles && (
                      <span className="lec-meta-pill" title="English Captions Available">
                        CC
                      </span>
                    )}
                  </div>

                  {/* Mini module progress track */}
                  <div className="mini-card-progress-track">
                    <div
                      className="mini-card-progress-fill"
                      style={{
                        width: `${lecPercent}%`,
                        background: isDone ? "#10b981" : "#3b82f6",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Exam Shortcut in Sidebar */}
          <div className="sidebar-exam-callout">
            <div className="callout-icon">
              <Icon name="award" size={22} />
            </div>
            <h4>Ready to certify?</h4>
            <p>Test your knowledge on the 40-question workplace exam.</p>
            <button className="callout-exam-btn" onClick={onStartExam}>
              Start Exam Now →
            </button>
          </div>
        </aside>

        {/* Right Content Area */}
        <section className="lecture-content-area">
          {loading ? (
            <div className="lecture-loading-spinner">
              <Icon name="rotate-ccw" className="spin-icon" size={32} />
              <p>Loading lecture briefings...</p>
            </div>
          ) : selectedLecture ? (
            <>
              {/* Lecture Title, Policy & Progress Banner */}
              <div className="lecture-content-header">
                <div className="lecture-title-left">
                  <div className="lecture-category-pill">{selectedLecture.category}</div>
                  <h2>{selectedLecture.title}</h2>
                  <p className="lecture-subtitle">{selectedLecture.subtitle}</p>
                </div>

                <div className="lecture-header-right">
                  {/* Module Completion Meter Card */}
                  <div className="module-progress-card">
                    <div className="progress-card-top">
                      <span className="card-progress-label">Module Checklist Progress</span>
                      <strong className="card-progress-value">{currentCompletionPercent}%</strong>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${currentCompletionPercent}%`,
                          background: currentCompletionPercent === 100 ? "#10b981" : "linear-gradient(90deg, #3b82f6, #06b6d4)",
                        }}
                      />
                    </div>
                    <span className="card-progress-sub">
                      {currentCompletionPercent === 100
                        ? "🎉 All checkpoints completed!"
                        : `${currentCompletedItems.length} items checked`}
                    </span>
                  </div>

                  <div className="lecture-doc-ref-box">
                    <div className="doc-ref-row">
                      <span className="doc-label">DOC REF:</span>
                      <span className="doc-val">{selectedLecture.docRef}</span>
                    </div>
                    {selectedLecture.policyRef && (
                      <div className="doc-ref-row">
                        <span className="doc-label">POLICY:</span>
                        <span className="doc-val">{selectedLecture.policyRef}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content Mode Switcher: Video vs Slides vs Checklist */}
              <div className="content-view-switcher">
                <button
                  type="button"
                  className={`view-switch-btn ${viewMode === "video" ? "active" : ""}`}
                  onClick={() => setViewMode("video")}
                >
                  <Icon name="video" size={16} />
                  <span>Video Briefing</span>
                  {currentCompletedItems.includes("video") && <span className="switch-check-icon">✓</span>}
                </button>

                <button
                  type="button"
                  className={`view-switch-btn ${viewMode === "slides" ? "active" : ""}`}
                  onClick={() => setViewMode("slides")}
                >
                  <Icon name="layers" size={16} />
                  <span>Slide Deck Viewer ({totalSlides} Slides)</span>
                  {currentCompletedItems.includes("slides") && <span className="switch-check-icon">✓</span>}
                </button>

                <button
                  type="button"
                  className={`view-switch-btn ${viewMode === "checklist" ? "active" : ""}`}
                  onClick={() => setViewMode("checklist")}
                >
                  <Icon name="check-square" size={16} />
                  <span>Module Checklist & Takeaways ({currentCompletionPercent}%)</span>
                </button>
              </div>

              {/* VIEW 1: VIDEO PLAYER */}
              {viewMode === "video" && (
                <div className="video-player-container">
                  <video
                    ref={videoRef}
                    className="lecture-video-player"
                    controls
                    playsInline
                    preload="metadata"
                    onTimeUpdate={handleTimeUpdate}
                    onPause={() => sendProgressHeartbeat("VIDEO_PAUSED")}
                    onEnded={handleVideoEnded}
                    src={api.getLectureVideoUrl(selectedLecture.id)}
                  >
                    {selectedLecture.hasSubtitles && (
                      <track
                        kind="subtitles"
                        src={api.getLectureSubtitlesUrl(selectedLecture.id)}
                        srcLang="en"
                        label="English Subtitles"
                        default
                      />
                    )}
                    Your browser does not support HTML5 video playback.
                  </video>

                  <div className="video-player-footer">
                    <div className="video-progress-stats">
                      <Icon name="video" size={16} />
                      <span>
                        Watch Session: {Math.floor(watchSeconds / 60)}m {watchSeconds % 60}s
                      </span>
                      {maxPercent > 0 && (
                        <span className="progress-badge">({maxPercent}% viewed)</span>
                      )}
                      {currentCompletedItems.includes("video") && (
                        <span className="checklist-status-badge completed">
                          <Icon name="check" size={12} /> Video Completed
                        </span>
                      )}
                    </div>

                    <div className="video-actions-right">
                      <button
                        className={`mark-done-toggle-btn ${currentCompletedItems.includes("video") ? "done" : ""}`}
                        onClick={() => updateChecklistItem("video")}
                        title="Mark video watching as completed in your checklist"
                      >
                        <Icon name={currentCompletedItems.includes("video") ? "check" : "check-square"} size={14} />
                        <span>{currentCompletedItems.includes("video") ? "Completed (35%)" : "Mark Video Watched"}</span>
                      </button>

                      <button
                        className="download-slides-btn"
                        onClick={handleDownloadSlides}
                        title="Download official presentation (.pptx) file"
                      >
                        <Icon name="download" size={15} />
                        <span>Download Slides (.pptx)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: INTERACTIVE SLIDE DECK VIEWER */}
              {viewMode === "slides" && (
                <div className="slide-deck-viewer-container">
                  <div className="slide-viewer-top-bar">
                    <div className="slide-counter-badge">
                      <Icon name="layers" size={15} />
                      <span>
                        Slide {currentSlideIndex + 1} of {totalSlides}
                      </span>
                    </div>

                    {/* Quick Jump Dropdown */}
                    <div className="slide-jump-control">
                      <label htmlFor="slide-jump-select">Jump to:</label>
                      <select
                        id="slide-jump-select"
                        value={currentSlideIndex}
                        onChange={(e) => setCurrentSlideIndex(Number(e.target.value))}
                        className="slide-select-dropdown"
                      >
                        {Array.from({ length: totalSlides }).map((_, idx) => {
                          const topic = selectedLecture.slides?.[idx]?.title;
                          return (
                            <option key={idx} value={idx}>
                              Slide {idx + 1}{topic ? `: ${topic.length > 40 ? `${topic.slice(0, 40)}...` : topic}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="slide-viewer-tools">
                      <button
                        className={`mark-slides-reviewed-btn ${currentCompletedItems.includes("slides") ? "done" : ""}`}
                        onClick={() => updateChecklistItem("slides")}
                      >
                        <Icon name={currentCompletedItems.includes("slides") ? "check" : "check-square"} size={14} />
                        <span>{currentCompletedItems.includes("slides") ? "Slides Reviewed (35%)" : "Mark Slides Reviewed"}</span>
                      </button>

                      <button
                        className="slide-tool-btn"
                        onClick={() => setIsSlideFullscreen(!isSlideFullscreen)}
                        title={isSlideFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Presentation"}
                      >
                        <Icon name={isSlideFullscreen ? "eye-off" : "eye"} size={15} />
                        <span>{isSlideFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                      </button>

                      <button className="download-slides-btn" onClick={handleDownloadSlides} title="Download official presentation (.pptx) file">
                        <Icon name="download" size={14} />
                        <span>Download (.pptx)</span>
                      </button>
                    </div>
                  </div>

                  {/* Authentic PowerPoint Slide Canvas */}
                  <div className={`slide-canvas-display ${isSlideFullscreen ? "slide-fullscreen-active" : ""}`}>
                    <div className="actual-slide-stage">
                      <img
                        key={`${selectedLecture.id}-slide-${currentSlideIndex + 1}`}
                        src={api.getLectureSlideImageUrl(selectedLecture.id, currentSlideIndex + 1)}
                        alt={`${selectedLecture.title} - Slide ${currentSlideIndex + 1}`}
                        className="actual-slide-image"
                        loading="eager"
                      />
                    </div>
                  </div>

                  {/* Bottom Navigation Toolbar */}
                  <div className="slide-navigation-toolbar">
                    <button
                      className="slide-nav-btn"
                      onClick={handlePrevSlide}
                      disabled={currentSlideIndex === 0}
                    >
                      <Icon name="arrow-left" size={15} />
                      <span>Previous Slide</span>
                    </button>

                    <div className="slide-thumbnails-strip">
                      {Array.from({ length: totalSlides }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`slide-thumb-btn ${idx === currentSlideIndex ? "active" : ""}`}
                          onClick={() => setCurrentSlideIndex(idx)}
                          title={`Slide ${idx + 1}`}
                        >
                          <span className="thumb-num">{idx + 1}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      className="slide-nav-btn primary"
                      onClick={handleNextSlide}
                      disabled={currentSlideIndex === totalSlides - 1}
                    >
                      <span>{currentSlideIndex === totalSlides - 1 ? "Completed" : "Next Slide"}</span>
                      <Icon name="arrow-right" size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 3: MODULE CHECKLIST & KEY CHECKPOINTS */}
              {viewMode === "checklist" && (
                <div className="checklist-view-container">
                  <div className="checklist-hero-card">
                    <div className="hero-left">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="checklist-badge">PROCEDURE READINESS CHECKLIST</div>
                        {savingChecklist && (
                          <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 650 }}>
                            Syncing...
                          </span>
                        )}
                      </div>
                      <h3>{selectedLecture.title}</h3>
                      <p>
                        Complete all items below to ensure full readiness and procedure compliance before sitting the
                        assessment exam.
                      </p>
                    </div>

                    <div className="hero-percentage-dial">
                      <div className="dial-value">{currentCompletionPercent}%</div>
                      <div className="dial-caption">
                        {currentCompletionPercent === 100 ? "Fully Certified" : "Module Progress"}
                      </div>
                    </div>
                  </div>

                  {/* Core Milestones */}
                  <div className="checklist-section">
                    <h4 className="checklist-section-title">
                      <Icon name="sliders" size={16} />
                      <span>Core Training Milestones (70% Total Weight)</span>
                    </h4>

                    <div className="checklist-items-grid">
                      {/* Milestone 1: Video */}
                      <div
                        className={`checklist-item-card ${currentCompletedItems.includes("video") ? "checked" : ""}`}
                        onClick={() => updateChecklistItem("video")}
                      >
                        <div className="item-checkbox">
                          <Icon name={currentCompletedItems.includes("video") ? "check-square" : "square"} size={22} />
                        </div>
                        <div className="item-details">
                          <div className="item-label-row">
                            <span className="item-title">Watch Video Briefing ({selectedLecture.durationFormatted})</span>
                            <span className="item-weight-pill">35% Weight</span>
                          </div>
                          <p className="item-desc">
                            Listen to the full procedure presentation and briefing recordings. (Auto-checks when you
                            watch 80%+ of video).
                          </p>
                        </div>
                        <span className={`item-status-pill ${currentCompletedItems.includes("video") ? "done" : ""}`}>
                          {currentCompletedItems.includes("video") ? "Completed" : "Pending"}
                        </span>
                      </div>

                      {/* Milestone 2: Slides */}
                      <div
                        className={`checklist-item-card ${currentCompletedItems.includes("slides") ? "checked" : ""}`}
                        onClick={() => updateChecklistItem("slides")}
                      >
                        <div className="item-checkbox">
                          <Icon name={currentCompletedItems.includes("slides") ? "check-square" : "square"} size={22} />
                        </div>
                        <div className="item-details">
                          <div className="item-label-row">
                            <span className="item-title">Review Slide Deck ({totalSlides} Slides)</span>
                            <span className="item-weight-pill">35% Weight</span>
                          </div>
                          <p className="item-desc">
                            Read through the presentation slides, governance structures, and procedure diagrams in the
                            built-in Slide Viewer.
                          </p>
                        </div>
                        <span className={`item-status-pill ${currentCompletedItems.includes("slides") ? "done" : ""}`}>
                          {currentCompletedItems.includes("slides") ? "Completed" : "Pending"}
                        </span>
                      </div>

                      {/* Milestone 3: Download */}
                      <div
                        className={`checklist-item-card ${currentCompletedItems.includes("download") ? "checked" : ""}`}
                        onClick={() => updateChecklistItem("download")}
                      >
                        <div className="item-checkbox">
                          <Icon name={currentCompletedItems.includes("download") ? "check-square" : "square"} size={22} />
                        </div>
                        <div className="item-details">
                          <div className="item-label-row">
                            <span className="item-title">Download Offline Reference Deck (.PPTX)</span>
                            <span className="item-weight-pill">10% Weight</span>
                          </div>
                          <p className="item-desc">
                            Save the official PowerPoint presentation file to your local computer for field and site
                            reference.
                          </p>
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="mini-download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadSlides();
                            }}
                          >
                            <Icon name="download" size={13} /> Download
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Procedure Key Checkpoints */}
                  {selectedLecture.checkpoints && selectedLecture.checkpoints.length > 0 && (
                    <div className="checklist-section">
                      <h4 className="checklist-section-title">
                        <Icon name="check-circle" size={16} />
                        <span>Key Procedure Takeaways & Checkpoints (20% Total Weight)</span>
                      </h4>

                      <div className="checklist-items-grid">
                        {selectedLecture.checkpoints.map((cp) => {
                          const isCpChecked = currentCompletedItems.includes(cp.id);
                          return (
                            <div
                              key={cp.id}
                              className={`checklist-item-card ${isCpChecked ? "checked" : ""}`}
                              onClick={() => updateChecklistItem(cp.id)}
                            >
                              <div className="item-checkbox">
                                <Icon name={isCpChecked ? "check-square" : "square"} size={22} />
                              </div>
                              <div className="item-details">
                                <div className="item-label-row">
                                  <span className="item-title">{cp.label}</span>
                                </div>
                                {cp.description && <p className="item-desc">{cp.description}</p>}
                              </div>
                              <span className={`item-status-pill ${isCpChecked ? "done" : ""}`}>
                                {isCpChecked ? "Verified" : "Check off"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Assessment Exam CTA */}
                  <div className="checklist-exam-prompt">
                    <div className="prompt-content">
                      <h4>Ready to demonstrate your mastery?</h4>
                      <p>
                        Upon reviewing the recording and slides, take the official proctored workplace assessment exam
                        to certify your compliance.
                      </p>
                    </div>
                    <button className="primary-button prompt-btn" onClick={onStartExam}>
                      <span>Take 40-Question Assessment Exam →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Quick Material Bar (Always accessible) */}
              <div className="portal-bottom-material-strip">
                <div className="strip-info">
                  <Icon name="file-text" size={16} />
                  <span>
                    Official Controlled Presentation: <strong>{selectedLecture.title}</strong> ({selectedLecture.slideCount} Slides)
                  </span>
                </div>
                <button className="download-slides-btn" onClick={handleDownloadSlides}>
                  <Icon name="download" size={14} />
                  <span>Download Slide Deck (.pptx)</span>
                </button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
