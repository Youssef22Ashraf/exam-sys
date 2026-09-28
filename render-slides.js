const puppeteer = require('puppeteer-core');
const { PDFDocument, PDFName, PDFString } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

function getBase64Image(filename) {
  const fullPath = path.join(__dirname, 'linkedin-assets', filename);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(filename).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext};base64,${data}`;
}

const images = {
  camera: getBase64Image('03_pre_exam_camera_instructions.png'),
  exam: getBase64Image('04_live_proctored_exam_interface.png'),
  admin: getBase64Image('06_admin_live_oversight_dashboard.png'),
  grafana: getBase64Image('12_grafana_system_overview.png'),
  promGraph: getBase64Image('10_prometheus_metric_graph.png'),
  ciPassed: getBase64Image('13_github_actions_ci_cd_checks_passed.png'),
  railway: getBase64Image('14_railway_production_deployment.png'),
};

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 1080px 1350px;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #090d16;
      color: #f1f5f9;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .slide {
      width: 1080px;
      height: 1350px;
      page-break-after: always;
      position: relative;
      background: radial-gradient(circle at 85% 15%, rgba(30, 58, 138, 0.4), transparent 50%),
                  radial-gradient(circle at 15% 85%, rgba(13, 148, 136, 0.25), transparent 45%),
                  #0a0f1d;
      padding: 56px 64px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    /* Top Bar */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(30, 58, 138, 0.45);
      border: 1px solid rgba(96, 165, 250, 0.4);
      color: #93c5fd;
      padding: 7px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }
    .tag-accent {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(52, 211, 153, 0.4);
      color: #6ee7b7;
    }
    .tag-purple {
      background: rgba(139, 92, 246, 0.2);
      border-color: rgba(167, 139, 250, 0.4);
      color: #c4b5fd;
    }
    .slide-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      color: #64748b;
    }

    /* Titles */
    .header {
      margin-bottom: 18px;
    }
    .header h2 {
      font-size: 36px;
      font-weight: 800;
      line-height: 1.2;
      color: #ffffff;
      letter-spacing: -0.8px;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 16px;
      color: #94a3b8;
      line-height: 1.5;
    }

    /* Screen Frame */
    .browser-frame {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(59, 130, 246, 0.12);
      margin-bottom: 22px;
      height: 640px;
      display: flex;
      flex-direction: column;
    }
    .browser-header {
      background: #1e293b;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }
    .dots {
      display: flex;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    .browser-url {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 4px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #94a3b8;
      flex: 1;
    }
    .browser-content {
      flex: 1;
      background: #020617;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      overflow: hidden;
    }
    .browser-content img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 6px;
    }

    /* Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 18px;
      flex-shrink: 0;
    }
    .feature-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 15px 16px;
    }
    .feature-card.highlight {
      border-color: rgba(59, 130, 246, 0.4);
      background: rgba(30, 58, 138, 0.22);
    }
    .feature-title {
      font-size: 14px;
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .feature-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.45;
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 13px;
      color: #64748b;
      flex-shrink: 0;
    }
    .author-info {
      font-weight: 600;
      color: #cbd5e1;
    }
    .author-info span {
      color: #38bdf8;
    }

    /* Cover Slide */
    .cover-slide {
      justify-content: center;
      text-align: left;
      gap: 34px;
      position: relative;
    }
    .cover-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 8px 18px;
      border-radius: 8px;
      width: fit-content;
    }
    .cover-title {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -1.5px;
      color: #ffffff;
    }
    .cover-title span {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cover-desc {
      font-size: 20px;
      line-height: 1.6;
      color: #94a3b8;
      max-width: 900px;
    }
    .stack-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pill.devops {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(52, 211, 153, 0.3);
      color: #6ee7b7;
    }
    .pill.proctor {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(129, 140, 248, 0.3);
      color: #a5b4fc;
    }
    .author-card {
      margin-top: 10px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .author-name {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .author-name a, .author-role a, .author-info a {
      color: inherit;
      text-decoration: none;
    }
    .portfolio-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(37, 99, 235, 0.25);
      border: 1px solid #3b82f6;
      color: #93c5fd;
      font-weight: 700;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 4px;
      text-decoration: none;
    }
    .author-role {
      font-size: 15px;
      color: #94a3b8;
    }
    .author-status {
      text-align: right;
    }
    .status-sub {
      font-size: 12px;
      color: #64748b;
    }

    /* Outro Slide */
    .outro-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }
    .outro-card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
    }
    .outro-card h3 {
      font-size: 18px;
      color: #38bdf8;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .outro-card ul {
      list-style: none;
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.8;
    }
    .outro-card ul li::before {
      content: "▹ ";
      color: #38bdf8;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <!-- SLIDE 1: COVER -->
  <div class="slide cover-slide">
    <div class="cover-badge">ENGINEERING CASE STUDY & DEVOPS SHOWCASE</div>
    <div>
      <h1 class="cover-title">Workplace Assessment &<br><span>Proctoring Platform</span></h1>
      <p class="cover-desc">
        A production-grade, zero-trust examination system engineered with browser-native video proctoring, server-authoritative scoring, multi-stage Docker containerization, and full Prometheus & Grafana observability.
      </p>
    </div>

    <div class="stack-pills">
      <div class="pill devops">🐳 Multi-Stage Docker</div>
      <div class="pill devops">📊 Prometheus Telemetry</div>
      <div class="pill devops">📈 Grafana Dashboards</div>
      <div class="pill devops">🚀 Railway Cloud Deployment</div>
      <div class="pill devops">⚙️ GitHub Actions CI/CD</div>
      <div class="pill proctor">🛡️ WebRTC & MediaRecorder</div>
      <div class="pill proctor">⚡ WebSockets / Socket.io</div>
      <div class="pill">🔷 TypeScript & React 19</div>
      <div class="pill">📦 Prisma ORM & SQLite</div>
    </div>

    <div class="author-card">
      <div>
        <div class="author-name">
          <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="color:#60a5fa;display:inline-flex;align-items:center;gap:8px;">
            Eng. Youssef Ashraf <span style="font-size:18px;">↗</span>
          </a>
        </div>
        <div class="author-role">Full-Stack & DevOps Engineer • <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="color:#38bdf8;text-decoration:underline;">portfolio-five-rosy-60.vercel.app</a></div>
      </div>
      <div class="author-status">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link">
          <div class="portfolio-badge">View Live Portfolio ↗</div>
        </a>
        <div class="status-sub">Available for Hire in 2 Months (Post-Military)</div>
      </div>
    </div>

    <div class="footer">
      <div>Swipe through for Architecture, Live UX & Observability ➔</div>
      <div class="slide-num">01 / 08</div>
    </div>
  </div>

  <!-- SLIDE 2: PROCTORING ENGINE -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag">01 • Proctoring Architecture</div>
      <div class="slide-num">02 / 08</div>
    </div>
    <div class="header">
      <h2>Browser-Native Camera Proctoring & Integrity Rules</h2>
      <p>Zero third-party proprietary plugins. Built entirely on modern HTML5, MediaStream, and Canvas Web APIs.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">https://mofarreh-exam-system.up.railway.app/#/instructions</div>
      </div>
      <div class="browser-content">
        <img src="${images.camera}" alt="Pre-exam Camera Verification">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card highlight">
        <div class="feature-title">📹 Face-Alignment Guide</div>
        <div class="feature-desc">Interactive SVG oval overlay guarantees optimal lighting, centered framing, and live camera feed verification before test entry.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">💾 IndexedDB Chunk Buffering</div>
        <div class="feature-desc">Records the entire sitting in time slices directly into client-side IndexedDB, preventing memory bloat before secure POST upload.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🚨 Window Blur Audit</div>
        <div class="feature-desc">Tab switching triggers candidate:warning events banking server-side warnings and locking attempts on excessive violations.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">02 / 08</div>
    </div>
  </div>

  <!-- SLIDE 3: ACTIVE EXAM SITTING -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag">02 • Candidate Experience</div>
      <div class="slide-num">03 / 08</div>
    </div>
    <div class="header">
      <h2>Live Timed 40-Question Examination Sitting</h2>
      <p>Two-part competency assessment with live recording indicators and synchronized question navigation.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">https://mofarreh-exam-system.up.railway.app/#/exam (Active Session)</div>
      </div>
      <div class="browser-content">
        <img src="${images.exam}" alt="Active Exam Interface">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card highlight">
        <div class="feature-title">🔴 Live Recording Badge</div>
        <div class="feature-desc">Active • REC (Video) indicator reassures compliance while MediaRecorder streams silent chunk uploads in the background.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">⏱️ Absolute Deadline Clock</div>
        <div class="feature-desc">Timestamp-based expiration prevents timer manipulation from page refreshes, tab throttling, or network drops.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🗂️ Split Matrix Layout</div>
        <div class="feature-desc">Interactive 40-question grid showing answered, flagged, and active questions across Part A & Part B modules.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">03 / 08</div>
    </div>
  </div>

  <!-- SLIDE 4: ADMIN COMMAND CENTER -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag">03 • Full-Stack Architecture</div>
      <div class="slide-num">04 / 08</div>
    </div>
    <div class="header">
      <h2>Supervisor Command Center & Real-Time Sync</h2>
      <p>Instant candidate tracking, server-authoritative scoring, and transactional supervisor notifications.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">https://mofarreh-exam-system.up.railway.app/#/admin (Supervisor Room)</div>
      </div>
      <div class="browser-content">
        <img src="${images.admin}" alt="Admin Oversight Dashboard">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">🔒 Server-Owned Scoring</div>
        <div class="feature-desc">Correct answers are omitted from client bundles. Scoring, attempt counters, and 48-hr lockouts are purely server-enforced.</div>
      </div>
      <div class="feature-card highlight">
        <div class="feature-title">⚡ Real-Time Push Events</div>
        <div class="feature-desc">Socket.io rooms synchronize active examinees, live warnings, and completion timestamps instantly to all connected supervisors.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">📧 Resend HTTPS Delivery</div>
        <div class="feature-desc">Transactional supervisor alerts dispatching score cards and proctoring summaries reliably over outbound HTTPS port 443.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">04 / 08</div>
    </div>
  </div>

  <!-- SLIDE 5: GRAFANA OBSERVABILITY -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag tag-accent">04 • DevOps & Observability</div>
      <div class="slide-num">05 / 08</div>
    </div>
    <div class="header">
      <h2>Production Observability with Grafana</h2>
      <p>Continuous monitoring of container health, Node.js memory profiling, and HTTP request throughput.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">http://grafana:3000/d/exam-system-overview (Environment: exam-system-production)</div>
      </div>
      <div class="browser-content">
        <img src="${images.grafana}" alt="Grafana Production Monitoring">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card highlight">
        <div class="feature-title">🟢 Core Health Status</div>
        <div class="feature-desc">Instant visibility into live Scrape Status (UP), Prisma/SQLite connectivity (Healthy), and continuous backend uptime.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🧠 Memory Profiling</div>
        <div class="feature-desc">Real-time metrics tracking Resident Set Size (~92 MiB), Heap Allocated (21.3 MiB), and Heap Used (16.8 MiB) under load.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">📊 HTTP Request Rates</div>
        <div class="feature-desc">Per-route request breakdown graphing latency distributions and traffic status codes (200 OK, 304 Not Modified).</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">05 / 08</div>
    </div>
  </div>

  <!-- SLIDE 6: PROMETHEUS TIME-SERIES -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag tag-accent">05 • Telemetry & Scraping</div>
      <div class="slide-num">06 / 08</div>
    </div>
    <div class="header">
      <h2>Prometheus Exporter & Time-Series Engine</h2>
      <p>Custom Prometheus metrics endpoint scraping cloud production targets with sub-300ms latency.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">http://prometheus:9090/graph (Query: http_requests_total)</div>
      </div>
      <div class="browser-content">
        <img src="${images.promGraph}" alt="Prometheus Metric Graph">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">🎯 Custom Prometheus Metrics</div>
        <div class="feature-desc">Custom Prom metrics (/metrics) reporting database latency, active WebSockets, memory, and HTTP traffic.</div>
      </div>
      <div class="feature-card highlight">
        <div class="feature-title">⚡ Sub-300ms Scrape Latency</div>
        <div class="feature-desc">Lightweight exporter returns metrics in ~273ms without blocking the Node.js event loop or taxing container CPU.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">📈 PromQL Time-Series</div>
        <div class="feature-desc">Full query engine evaluating rate(http_requests_total[5m]), failure spikes, and proctoring socket counts.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">06 / 08</div>
    </div>
  </div>

  <!-- SLIDE 7: GITHUB ACTIONS CI/CD -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag tag-accent">06 • Continuous Integration</div>
      <div class="slide-num">07 / 08</div>
    </div>
    <div class="header">
      <h2>Automated CI/CD Quality Gates</h2>
      <p>GitHub Actions pipeline enforcing TypeScript compilation, ESLint, unit tests, and Docker builds.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">github.com/Youssef22Ashraf/exam-sys/pull/15 (4 Checks Passed)</div>
      </div>
      <div class="browser-content">
        <img src="${images.ciPassed}" alt="GitHub Actions CI/CD">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card highlight">
        <div class="feature-title">🐳 Docker Build Verification</div>
        <div class="feature-desc">Builds and validates production Docker container image on pull request before merge to guarantee build stability.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🔍 TypeScript & ESLint</div>
        <div class="feature-desc">Zero-compromise static analysis: tsc -b frontend and tsc backend run with strict flags to prevent regressions.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🧪 Automated Test Suite</div>
        <div class="feature-desc">Automated unit and integration testing of pure scoring logic, cooldown algorithms, and route endpoints.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#60a5fa;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Workplace Examination System</span>
      </div>
      <div class="slide-num">07 / 08</div>
    </div>
  </div>

  <!-- SLIDE 8: CLOUD DEPLOYMENT & SUMMARY -->
  <div class="slide">
    <div class="top-bar">
      <div class="tag tag-purple">07 • Cloud & Architecture Summary</div>
      <div class="slide-num">08 / 08</div>
    </div>
    <div class="header">
      <h2>Cloud Production Deployment on Railway</h2>
      <p>Multi-stage Docker container deployed with persistent volumes and edge SSL routing.</p>
    </div>

    <div class="browser-frame">
      <div class="browser-header">
        <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
        <div class="browser-url">railway.app/project/exam-sys (Production Environment: EU West)</div>
      </div>
      <div class="browser-content">
        <img src="${images.railway}" alt="Railway Cloud Production">
      </div>
    </div>

    <div class="features-grid">
      <div class="feature-card highlight">
        <div class="feature-title">🚀 Unified Single-Port Hosting</div>
        <div class="feature-desc">Express API + Vite SPA bundled into one container on port 5000, eliminating CORS and proxy complexity.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">💾 Persistent Volume Mounts</div>
        <div class="feature-desc">Mounted volumes (/app/prisma, /app/uploads) ensure database state and video archives persist across re-deploys.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🔄 Git-Triggered Deployments</div>
        <div class="feature-desc">Automated zero-downtime rolling updates on push to main branch with automated migrations and health checks.</div>
      </div>
    </div>

    <div class="footer">
      <div class="author-info">
        <a href="https://portfolio-five-rosy-60.vercel.app/" target="_blank" class="portfolio-link" style="display:inline-flex;align-items:center;gap:6px;">
          <span style="color:#34d399;font-weight:700;">Eng. Youssef Ashraf ↗</span>
          <span style="color:#64748b;font-size:13px;">(portfolio-five-rosy-60.vercel.app)</span>
        </a>
        • <span>Available for Hire in 2 Months</span>
      </div>
      <div class="slide-num">08 / 08</div>
    </div>
  </div>

</body>
</html>
`;

(async () => {
  fs.writeFileSync('slide-deck.html', htmlContent);
  console.log('Updated 8-slide deck in slide-deck.html');

  console.log('Launching browser to capture slides...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1.5 });

  const fileUrl = 'file:///' + path.resolve('slide-deck.html').replace(/\\/g, '/');
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const slides = await page.$$('.slide');
  console.log(`Found ${slides.length} slides.`);

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < slides.length; i++) {
    console.log(`Rendering slide ${i + 1}/${slides.length}...`);
    const slide = slides[i];
    const imgBuf = await slide.screenshot({ type: 'png' });
    
    // Save slide PNG
    const slidePath = path.join(__dirname, 'linkedin-assets', `carousel_slide_${i + 1}.png`);
    fs.writeFileSync(slidePath, imgBuf);
    console.log(`Saved ${slidePath}`);

    // Embed into PDF
    const embeddedImg = await pdfDoc.embedPng(imgBuf);
    const pdfPage = pdfDoc.addPage([1080, 1350]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 1080,
      height: 1350
    });
    // Add real PDF link annotations for portfolio links on each page
    const linkElements = await slide.$$('.portfolio-link, .author-card, .author-info');
    const slideBox = await slide.boundingBox();
    const annots = [];

    for (const el of linkElements) {
      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;

      const relX = box.x - slideBox.x;
      const relY = box.y - slideBox.y;

      // In PDF coordinates: origin (0,0) is bottom-left of the 1080x1350 page
      const pdfX1 = relX;
      const pdfY1 = 1350 - (relY + box.height);
      const pdfX2 = relX + box.width;
      const pdfY2 = 1350 - relY;

      const linkAnnot = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [pdfX1, pdfY1, pdfX2, pdfY2],
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of('https://portfolio-five-rosy-60.vercel.app/'),
        },
      });
      annots.push(pdfDoc.context.register(linkAnnot));
    }

    if (annots.length > 0) {
      pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj(annots));
    }
  }

  const pdfBytes = await pdfDoc.save();
  const finalPdfPath = path.join(__dirname, 'linkedin-assets', 'Youssef_Ashraf_Exam_System_DevOps_Showcase.pdf');
  fs.writeFileSync(finalPdfPath, pdfBytes);
  console.log(`Generated 8-slide PDF carousel at: ${finalPdfPath} (${pdfBytes.length} bytes)!`);

  await browser.close();
  console.log('All slides and PDF completed successfully!');
})();
