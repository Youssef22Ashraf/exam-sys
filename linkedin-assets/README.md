# LinkedIn Post Visual Assets

This directory contains high-resolution (2x Retina DPI) screenshots captured directly from the live production deployment and the monitoring/observability stack of the **Workplace Assessment & Examination Platform**.

---

## 📄 LinkedIn Document Carousel (Ready to Upload)

The complete presentation slide deck has been compiled into a high-resolution, 8-page PDF document optimized specifically for LinkedIn's **"Add a document"** post feature (1080x1350 4:5 mobile-optimized aspect ratio):

📁 **[`Youssef_Ashraf_Exam_System_DevOps_Showcase.pdf`](Youssef_Ashraf_Exam_System_DevOps_Showcase.pdf)** (5.1 MB, 8 Slides)

### Slide Breakdown:
1. **Slide 1**: [`carousel_slide_1.png`](carousel_slide_1.png) — **Title Cover**: Engineering Case Study & DevOps Showcase, Tech Stack Badges, Author Availability Status.
2. **Slide 2**: [`carousel_slide_2.png`](carousel_slide_2.png) — **Proctoring Engine**: Webcam Face-Alignment Guide, IndexedDB Buffering, Tab-Blur Auditing.
3. **Slide 3**: [`carousel_slide_3.png`](carousel_slide_3.png) — **Candidate Experience**: Live Proctored Exam Interface, Recording Badge, Timestamp-Based Expiry Clock.
4. **Slide 4**: [`carousel_slide_4.png`](carousel_slide_4.png) — **Full-Stack Architecture**: Supervisor Command Center, WebSocket Push Events, Resend HTTPS Delivery.
5. **Slide 5**: [`carousel_slide_5.png`](carousel_slide_5.png) — **DevOps & Observability**: Grafana Production Dashboard, Core Health (UP & Healthy), Memory Profiling (RSS & Heap), Request Distribution.
6. **Slide 6**: [`carousel_slide_6.png`](carousel_slide_6.png) — **Telemetry & Scraping**: Prometheus Metrics Exporter, Sub-300ms Scrape Latency, PromQL Time-Series Engine.
7. **Slide 7**: [`carousel_slide_7.png`](carousel_slide_7.png) — **Continuous Integration**: GitHub Actions CI Quality Gate, 4/4 Passed Checks (Docker, TypeScript, ESLint, Tests).
8. **Slide 8**: [`carousel_slide_8.png`](carousel_slide_8.png) — **Cloud Deployment**: Railway Cloud Production, Multi-Stage Container, Persistent Volumes (`/app/prisma`, `/app/uploads`).

---

## 📸 Recommended Image Carousel Strategy

Depending on whether you want a **Product / Full-Stack** focus or a **DevOps / Cloud Architecture** focus, here are the two optimal 4-to-5 image carousel layouts:

### Option A: The Full-Stack & DevOps Power Carousel (Recommended)
This gives recruiters and engineering leads the complete picture: an end-to-end engineered system with live frontend proctoring, a supervisor command center, automated CI/CD, and real-time observability.

| Order | Filename | Description | Value Highlight |
|---|---|---|---|
| **1 (Hero)** | [`03_pre_exam_camera_instructions.png`](03_pre_exam_camera_instructions.png) | **Pre-Exam Camera Check & Integrity Rules** | Immediate visual hook: live camera stream, face oval overlay, and strict anti-cheating policy checklist. |
| **2** | [`04_live_proctored_exam_interface.png`](04_live_proctored_exam_interface.png) | **Live 40-Question Exam Sitting** | Active `• REC (Video)` proctoring badge, real-time timer countdown, zero warnings counter, and clean responsive UI. |
| **3** | [`06_admin_live_oversight_dashboard.png`](06_admin_live_oversight_dashboard.png) | **Supervisor Live Command Center** | Real-time candidate monitoring, WebSocket live sync indicator, score breakdowns, and audit logs. |
| **4** | [`12_grafana_system_overview.png`](12_grafana_system_overview.png) | **Grafana Production Observability** | Vibrant green **UP** & **Healthy** status tiles, Node.js memory profiling (RSS/Heap), request rates, and container telemetry. |
| **5** | [`13_github_actions_ci_cd_checks_passed.png`](13_github_actions_ci_cd_checks_passed.png) | **Automated CI/CD Quality Gate** | 4/4 passing checks: multi-stage Docker build, TypeScript strict type checks, ESLint, and automated test suite. |

---

### Option B: Deep DevOps & Observability Showcase
If targeting DevOps / SRE / Cloud Platform Engineering roles:

| Order | Filename | Description | Value Highlight |
|---|---|---|---|
| **1 (Hero)** | [`12_grafana_system_overview.png`](12_grafana_system_overview.png) | **Grafana Production Health & Telemetry** | Full system overview: Service UP, DB Healthy, Uptime, Node.js memory graphs, and request distribution. |
| **2** | [`09_prometheus_active_targets.png`](09_prometheus_active_targets.png) | **Prometheus Active Scraping Targets** | Live scrape of Railway production endpoint (`/metrics`) with sub-300ms scrape latency. |
| **3** | [`10_prometheus_metric_graph.png`](10_prometheus_metric_graph.png) | **Prometheus Time-Series Query Graph** | `http_requests_total` metric telemetry graphing endpoint usage and HTTP status codes. |
| **4** | [`14_railway_production_deployment.png`](14_railway_production_deployment.png) | **Cloud Production Deployment on Railway** | Active multi-stage Docker deployment with persistent volume bindings (`/app/prisma`, `/app/uploads`) and automated Git rollouts. |
| **5** | [`13_github_actions_ci_cd_checks_passed.png`](13_github_actions_ci_cd_checks_passed.png) | **GitHub Actions CI/CD Pipeline** | Automated image verification and test passes before deployment. |

---

## 📁 Complete Screenshot Index

### 🖥️ Application & Proctoring UI
1. [`01_examinee_portal_home.png`](01_examinee_portal_home.png) — Candidate entry portal welcoming examinees to the Mofarreh Group platform.
2. [`02_candidate_registration_form.png`](02_candidate_registration_form.png) — Registration form collecting Full Name, Corporate Email, and Employee ID.
3. [`03_pre_exam_camera_instructions.png`](03_pre_exam_camera_instructions.png) — Interactive webcam readiness verification, face alignment oval, and compliance checklist.
4. [`04_live_proctored_exam_interface.png`](04_live_proctored_exam_interface.png) — Active proctored examination sitting with question grid, live video badge, and clock.
5. [`05_admin_login_portal.png`](05_admin_login_portal.png) — Secure administrator and supervisor access portal.
6. [`06_admin_live_oversight_dashboard.png`](06_admin_live_oversight_dashboard.png) — Real-time supervisor dashboard with WebSocket sync and candidate attempt records.
7. [`07_admin_question_bank_editor.png`](07_admin_question_bank_editor.png) — Live Question Bank CRUD and exam configuration controls.
8. [`08_admin_settings_and_alerts.png`](08_admin_settings_and_alerts.png) — Alert email settings, Resend HTTPS delivery status badge, and passing mark configuration.

### ⚙️ DevOps, Infrastructure & Observability
9. [`09_prometheus_active_targets.png`](09_prometheus_active_targets.png) — Prometheus Target Health dashboard showing active scraping of Railway production.
10. [`10_prometheus_metric_graph.png`](10_prometheus_metric_graph.png) — Prometheus graph visualizing real-time `http_requests_total` traffic telemetry.
11. [`11_grafana_production_monitoring_dashboard.png`](11_grafana_production_monitoring_dashboard.png) — Grafana Live DevOps Metrics tracking DB status, active sockets, and route request rates.
12. [`12_grafana_system_overview.png`](12_grafana_system_overview.png) — Comprehensive Grafana Production Monitoring dashboard (Service UP, Memory RSS/Heap, Database Health, Request Rates).
13. [`13_github_actions_ci_cd_checks_passed.png`](13_github_actions_ci_cd_checks_passed.png) — GitHub Actions CI/CD pipeline showing 4 green passing checks.
14. [`14_railway_production_deployment.png`](14_railway_production_deployment.png) — Railway cloud production service showing active deployment, volume mounts, and automated git deployment.

---

## 🔗 Links for Post / Comments

- 🌐 **Live Portfolio**: https://portfolio-five-rosy-60.vercel.app/
- 🚀 **Live Production URL**: https://mofarreh-exam-system.up.railway.app
- 📦 **GitHub Repository**: https://github.com/Youssef22Ashraf/exam-sys
