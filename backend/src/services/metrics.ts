import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";

let getClientCount: () => number = () => 0;

export function registerSocketClientCounter(getter: () => number) {
  getClientCount = getter;
}

interface RequestMetricKey {
  method: string;
  route: string;
  status: string;
}

// In-memory Prometheus metric stores
const requestCounts = new Map<string, number>();
let totalRequestDurationSeconds = 0;
let totalRequestDurationCount = 0;

/**
 * Normalizes dynamic route patterns (e.g. /api/candidates/abc-123 -> /api/candidates/:id)
 * to avoid cardinality explosion in Prometheus / Grafana.
 */
function normalizeRoute(path: string): string {
  if (!path) return "unknown";
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+/g, "/:id");
}

/**
 * Middleware tracking HTTP request counts and latencies for Prometheus.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  res.on("finish", () => {
    // Skip recording metrics for the /metrics scraper itself to avoid loop skew
    if (req.path === "/metrics" || req.path === "/api/metrics") return;

    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    totalRequestDurationSeconds += durationSeconds;
    totalRequestDurationCount++;

    const method = req.method;
    const route = normalizeRoute(req.baseUrl + (req.route?.path || req.path));
    const status = String(res.statusCode);

    const key = `${method}|${route}|${status}`;
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  });

  next();
}

/**
 * Probes the database to verify live connectivity.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats collected metrics into Prometheus Exposition text format (0.0.4).
 */
export async function getPrometheusMetrics(): Promise<string> {
  const memory = process.memoryUsage();
  const uptimeSeconds = process.uptime();
  const dbConnected = await checkDatabaseHealth();
  const wsClients = getClientCount();

  const lines: string[] = [
    "# HELP nodejs_uptime_seconds Process uptime in seconds.",
    "# TYPE nodejs_uptime_seconds gauge",
    `nodejs_uptime_seconds ${uptimeSeconds.toFixed(2)}`,
    "",
    "# HELP nodejs_memory_heap_total_bytes Total size of the allocated heap in bytes.",
    "# TYPE nodejs_memory_heap_total_bytes gauge",
    `nodejs_memory_heap_total_bytes ${memory.heapTotal}`,
    "",
    "# HELP nodejs_memory_heap_used_bytes Memory currently used by objects in heap.",
    "# TYPE nodejs_memory_heap_used_bytes gauge",
    `nodejs_memory_heap_used_bytes ${memory.heapUsed}`,
    "",
    "# HELP nodejs_memory_rss_bytes Resident Set Size: memory allocated for the process execution.",
    "# TYPE nodejs_memory_rss_bytes gauge",
    `nodejs_memory_rss_bytes ${memory.rss}`,
    "",
    "# HELP database_up Database connectivity health probe (1 = connected, 0 = disconnected).",
    "# TYPE database_up gauge",
    `database_up ${dbConnected ? 1 : 0}`,
    "",
    "# HELP websocket_connected_clients Number of active Socket.io connected clients.",
    "# TYPE websocket_connected_clients gauge",
    `websocket_connected_clients ${wsClients}`,
    "",
    "# HELP http_requests_total Total number of HTTP requests processed by method, route, and status.",
    "# TYPE http_requests_total counter",
  ];

  for (const [key, count] of requestCounts.entries()) {
    const [method, route, status] = key.split("|");
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  lines.push(
    "",
    "# HELP http_request_duration_seconds_total Total duration of handled HTTP requests in seconds.",
    "# TYPE http_request_duration_seconds_total counter",
    `http_request_duration_seconds_total ${totalRequestDurationSeconds.toFixed(6)}`,
    "",
    "# HELP http_request_duration_seconds_count Total count of timed HTTP requests.",
    "# TYPE http_request_duration_seconds_count counter",
    `http_request_duration_seconds_count ${totalRequestDurationCount}`,
    ""
  );

  return lines.join("\n");
}
