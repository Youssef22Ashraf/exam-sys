# 📊 Prometheus & Grafana Monitoring Stack

This directory contains the ready-to-use observability stack for the **Workplace Assessment System**.

---

## 🚀 How to Run

### Step 1: Start the Backend (Metric Producer)
Make sure the exam system backend is running on port 5000:
```bash
cd backend
npm run dev
```
Verify the metrics are flowing:
👉 Open `http://localhost:5000/metrics` or `http://localhost:5000/health` in your browser.

---

### Step 2: Start Prometheus & Grafana (Visual Consumer)
Open Docker Desktop on your machine, then run:
```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

This launches:
1. **Prometheus**: Runs on `http://localhost:9090`
   - Scrapes metrics from `http://localhost:5000/metrics` every 5 seconds.
2. **Grafana**: Runs on `http://localhost:3000`
   - Automatically connected to Prometheus as its default data source.
   - Default login:
     - **Username:** `admin`
     - **Password:** `admin`

---

## 📈 Visualizing in Grafana

1. Open `http://localhost:3000` and sign in with `admin` / `admin`.
2. Click **Explore** (Compass icon on left menu) or **Dashboards** → **New Dashboard** → **Add visualization**.
3. Select **Prometheus** as data source.
4. Try any of these sample queries in the Metric field:
   - **Active WebSocket Examinees:** `websocket_connected_clients`
   - **Heap Memory Used (MB):** `nodejs_memory_heap_used_bytes / 1024 / 1024`
   - **HTTP Request Rate by Route:** `sum(rate(http_requests_total[1m])) by (route)`
   - **Database Health Probe:** `database_up`
   - **Uptime in Minutes:** `nodejs_uptime_seconds / 60`
