# 📊 Prometheus & Grafana Monitoring Stack

This directory contains the complete, production-ready observability and metrics stack for the **Workplace Assessment & Examination Platform**.

---

## 🌐 Monitored Environments

The Prometheus scraper (`prometheus.yml`) is configured to monitor both live production and local development environments simultaneously:

| Environment | Target URL | Scrape Scheme | Metrics Endpoint |
|---|---|---|---|
| **🔴 Railway Production** | `mofarreh-exam-system.up.railway.app` | HTTPS | `https://mofarreh-exam-system.up.railway.app/metrics` |
| **🟢 Local Development** | `host.docker.internal:5000` | HTTP | `http://localhost:5000/metrics` |

---

## 🚀 Quick Start

### 1. Launch Prometheus & Grafana Containers
From the root of the repository, execute:

```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

This starts two services in Docker:
- **Prometheus** on port [`9090`](http://localhost:9090)
- **Grafana** on port [`3000`](http://localhost:3000)

---

## 📈 Visualizing in Grafana

1. Open [`http://localhost:3000`](http://localhost:3000) in your web browser.
2. Sign in with the default credentials:
   - **Username:** `admin`
   - **Password:** `admin`
3. Navigate directly to the pre-provisioned dashboard:
   👉 **Dashboards** → **[Workplace Exam System - Production Monitoring](http://localhost:3000/d/exam-system-overview/workplace-exam-system-production-monitoring)**

### Pre-Configured Dashboard Panels:
- 🟢 **Service Scrape Status (`up`)**: Real-time probe status of the monitoring target.
- 🗄️ **Database Connection (`database_up`)**: Live heartbeat to SQLite database (`1` = healthy, `0` = disconnected).
- 👥 **Active Proctoring Sockets (`websocket_connected_clients`)**: Count of live candidates & supervisors connected via WebSockets.
- ⏱️ **Backend Uptime (`nodejs_uptime_seconds`)**: Process uptime in seconds.
- 💾 **Node.js Memory Profiling**: Real-time Resident Set Size (RSS), Heap Total, and Heap Used.
- ⚡ **HTTP Request Rate & Status Codes (`http_requests_total`)**: Throughput broken down by route and HTTP status code.
- ⏳ **Average Request Latency**: Rolling response duration tracking.

---

## 🔍 Prometheus Direct Queries

You can also inspect raw metrics directly in the Prometheus Expression Browser at [`http://localhost:9090`](http://localhost:9090):

- **Target Health:** [`http://localhost:9090/targets`](http://localhost:9090/targets)
- **Database Status:** `database_up{job="exam-system-production"}`
- **Active Examinees:** `websocket_connected_clients{job="exam-system-production"}`
- **Process Memory (MB):** `nodejs_memory_rss_bytes{job="exam-system-production"} / 1024 / 1024`
- **Process Uptime (Hours):** `nodejs_uptime_seconds{job="exam-system-production"} / 3600`
