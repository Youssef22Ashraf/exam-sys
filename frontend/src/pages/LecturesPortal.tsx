import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "../components/Icon";
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
  const [activeTab, setActiveTab] = useState<"video" | "outline" | "materials">("video");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [maxPercent, setMaxPercent] = useState(0);
  const lastHeartbeatTime = useRef<number>(0);
  const currentAttendanceId = useRef<string | undefined>(user.attendanceId);

  // Fetch all lectures on mount
  useEffect(() => {
    let mounted = true;
    api.getLectures().then((list) => {
      if (!mounted) return;
      if (list && list.length > 0) {
        setLectures(list);
        setSelectedId(list[0].id);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch full details of selected lecture
  useEffect(() => {
    let mounted = true;
    if (!selectedId) return;

    api.getLectureDetails(selectedId).then((lec) => {
      if (!mounted) return;
      setSelectedLecture(lec);
      setWatchSeconds(0);
      setMaxPercent(0);
      lastHeartbeatTime.current = 0;

      // Log lecture switch
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
    },
    [selectedLecture, user, maxPercent]
  );

  // Video timeupdate handler
  function handleTimeUpdate() {
    if (!videoRef.current) return;
    const now = Math.floor(videoRef.current.currentTime);
    // Send heartbeat every 10 seconds of playback
    if (now > 0 && now - lastHeartbeatTime.current >= 10) {
      lastHeartbeatTime.current = now;
      sendProgressHeartbeat("VIDEO_WATCHED");
    }
  }

  function handleVideoEnded() {
    sendProgressHeartbeat("VIDEO_COMPLETED");
  }

  function handleDownloadSlides() {
    if (!selectedLecture) return;
    const downloadUrl = api.getLectureSlidesUrl(selectedLecture.id, user);
    window.open(downloadUrl, "_blank");
  }

  return (
    <div className="lectures-portal-wrapper">
      {/* Top Banner Navigation */}
      <header className="lectures-portal-nav">
        <div className="portal-brand">
          <div className="portal-logo-badge">
            <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" />
          </div>
          <div className="portal-title-block">
            <span className="portal-heading">E&C TRAINING & PROCEDURE PORTAL</span>
            <span className="portal-subheading">Engineering & Construction Sector Governance</span>
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
              return (
                <button
                  key={lec.id}
                  type="button"
                  className={`lecture-nav-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedId(lec.id)}
                >
                  <div className="lec-card-category-badge">{lec.category}</div>
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
                </button>
              );
            })}
          </div>

          {/* Quick Exam Shortcut in Sidebar */}
          <div className="sidebar-exam-callout">
            <div className="callout-icon">
              <Icon name="zap" size={20} />
            </div>
            <h4>Ready to certify?</h4>
            <p>Test your knowledge on the 40-question workplace exam.</p>
            <button className="callout-exam-btn" onClick={onStartExam}>
              Start Exam Now →
            </button>
          </div>
        </aside>

        {/* Right Content Area: Video Player & Lecture Content */}
        <section className="lecture-content-area">
          {loading ? (
            <div className="lecture-loading-spinner">
              <Icon name="rotate-ccw" className="spin-icon" size={32} />
              <p>Loading lecture briefings...</p>
            </div>
          ) : selectedLecture ? (
            <>
              {/* Lecture Title & Policy Badges */}
              <div className="lecture-content-header">
                <div className="lecture-title-left">
                  <div className="lecture-category-pill">{selectedLecture.category}</div>
                  <h2>{selectedLecture.title}</h2>
                  <p className="lecture-subtitle">{selectedLecture.subtitle}</p>
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

              {/* Video Player */}
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
                  </div>

                  <div className="video-actions-right">
                    <button
                      className="download-slides-btn"
                      onClick={handleDownloadSlides}
                      title="Download presentation (.pptx) file"
                    >
                      <Icon name="download" size={15} />
                      <span>Download Slides ({selectedLecture.slideCount} Slides .pptx)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtabs: Key Topics & Slide-by-Slide Outline */}
              <div className="lecture-tabs-container">
                <div className="lecture-tabs-header">
                  <button
                    className={`lec-tab-btn ${activeTab === "video" ? "active" : ""}`}
                    onClick={() => setActiveTab("video")}
                  >
                    <Icon name="file-text" size={15} />
                    <span>Procedure Description & Key Topics</span>
                  </button>
                  <button
                    className={`lec-tab-btn ${activeTab === "outline" ? "active" : ""}`}
                    onClick={() => setActiveTab("outline")}
                  >
                    <Icon name="clipboard" size={15} />
                    <span>Slide-by-Slide Agenda ({selectedLecture.slideCount})</span>
                  </button>
                  <button
                    className={`lec-tab-btn ${activeTab === "materials" ? "active" : ""}`}
                    onClick={() => setActiveTab("materials")}
                  >
                    <Icon name="download" size={15} />
                    <span>Controlled Documents & Files</span>
                  </button>
                </div>

                <div className="lecture-tab-body">
                  {activeTab === "video" && (
                    <div className="tab-overview">
                      <div className="overview-section">
                        <h4>Executive Procedure Summary</h4>
                        <p>{selectedLecture.description}</p>
                      </div>

                      <div className="overview-section">
                        <h4>Core Learning Objectives & Topics</h4>
                        <ul className="key-topics-list">
                          {selectedLecture.keyTopics.map((topic, i) => (
                            <li key={i}>
                              <Icon name="check" size={16} className="topic-check" />
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTab === "outline" && (
                    <div className="tab-outline">
                      <h4>Presentation Slide Outline</h4>
                      <div className="outline-grid">
                        {selectedLecture.outline && selectedLecture.outline.length > 0 ? (
                          selectedLecture.outline.map((slide) => (
                            <div key={slide.slideNumber} className="outline-item">
                              <span className="slide-num-pill">
                                Slide {slide.slideNumber.toString().padStart(2, "0")}
                              </span>
                              <span className="slide-title-text">{slide.title}</span>
                            </div>
                          ))
                        ) : (
                          <p>Full presentation available via the download slides button.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "materials" && (
                    <div className="tab-materials">
                      <h4>Downloadable Procedure Files</h4>
                      <div className="material-download-card">
                        <div className="material-icon">
                          <Icon name="file-text" size={24} />
                        </div>
                        <div className="material-info">
                          <span className="material-title">{selectedLecture.title}</span>
                          <span className="material-sub">
                            {selectedLecture.slideCount} Slides • Microsoft PowerPoint (.pptx)
                          </span>
                        </div>
                        <button className="material-btn" onClick={handleDownloadSlides}>
                          <Icon name="download" size={16} />
                          <span>Download .pptx</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
