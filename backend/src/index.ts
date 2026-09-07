import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables before config/env reads them
dotenv.config();

import jwt from "jsonwebtoken";
import { CORS_ORIGIN, JWT_SECRET } from "./config/env";
import { recordWarning } from "./services/examSession";

import authRoutes from "./routes/authRoutes";
import candidateRoutes from "./routes/candidateRoutes";
import questionRoutes from "./routes/questionRoutes";
import examRoutes from "./routes/examRoutes";
import proctorRoutes from "./routes/proctorRoutes";
import settingRoutes from "./routes/settingRoutes";

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Configure Socket.IO
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: CORS_ORIGIN !== "*",
  },
});

app.set("io", io);

/**
 * Sockets presenting a valid admin JWT join the `admins` room; everyone else
 * connects as a candidate and can only emit. Without this, `io.emit` delivered
 * every candidate's name, email and company ID to every connected client,
 * candidates included.
 */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (typeof token === "string" && token) {
    try {
      jwt.verify(token, JWT_SECRET);
      socket.data.isAdmin = true;
    } catch {
      // An invalid token is not a connection error — the socket simply does
      // not get admin visibility.
      socket.data.isAdmin = false;
    }
  }
  next();
});

io.on("connection", (socket) => {
  if (socket.data.isAdmin) {
    socket.join("admins");
  }

  // When candidate switches tab or triggers warning.
  // The count is banked against the server-owned sitting so the submit body
  // cannot under-report it (services/examSession.ts).
  socket.on("candidate:warning", (payload) => {
    if (payload?.sessionId) {
      recordWarning(payload.sessionId).catch((err) =>
        console.error("Failed to record proctor warning:", err)
      );
    }
    io.to("admins").emit("admin:candidate_warning", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  // When candidate starts exam
  socket.on("candidate:started", (payload) => {
    io.to("admins").emit("admin:candidate_started", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  // When candidate finishes exam
  socket.on("candidate:submitted", (payload) => {
    io.to("admins").emit("admin:exam_submitted", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    // client disconnected
  });
});

// Railway (and any reverse proxy) terminates TLS and forwards the client IP in
// X-Forwarded-For. Without this, req.ip is the proxy's address for every
// request, so middleware/rateLimit.ts shares one bucket across all users — the
// login limiter became a global 10-per-15-minutes lockout.
app.set("trust proxy", 1);

/**
 * Security headers.
 *
 * Deliberately not `helmet`: its Content-Security-Policy is the reason to
 * reach for it, and this SPA uses element style attributes and Vite-injected
 * <style> blocks throughout, so the CSP would have to be disabled — leaving
 * four headers that are cheaper to set directly than to take a dependency for.
 * If a real CSP is ever wanted, that is the moment to add helmet.
 */
app.use((_req: Request, res: Response, next: NextFunction) => {
  // The one that matters most here: uploads are user-supplied files served
  // back by an authenticated route, and nosniff stops a mistyped one being
  // interpreted as HTML on this origin.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // authenticateAdmin accepts `?token=`, so the URL can carry a JWT. Never
  // leak it in a Referer.
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: CORS_ORIGIN !== "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 50mb applied to every route, including login. `answers` is unvalidated and
// gets JSON.stringify'd straight into a row, so one public request could write
// ~50mb into SQLite. Only the submit needs headroom, for the base64 snapshot.
app.use("/api/exam/submit", express.json({ limit: "8mb" }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Uploaded snapshots and recordings are NOT served statically. They are
// candidate webcam footage; every read goes through an authenticated route in
// routes/proctorRoutes.ts. A public `express.static` mount here made the
// snapshots world-readable and gave the admin-only video route a second,
// unguarded door.
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static frontend SPA bundle in production
const candidateFrontendPaths = [
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(__dirname, "../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
];
const frontendDist = candidateFrontendPaths.find((p) => fs.existsSync(p));
if (frontendDist) {
  console.log(`Serving frontend static bundle from: ${frontendDist}`);
  app.use(express.static(frontendDist));
}

// API Routes
app.use("/api/admin", authRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/proctor", proctorRoutes);
app.use("/api/settings", settingRoutes);

// Health Check Endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Workplace Assessment System API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    websockets: "active",
    frontendServed: Boolean(frontendDist),
  });
});

// SPA Client-Side Routing Fallback (for React pages like /admin, /admin/login)
if (frontendDist) {
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Global Error Handler.
//
// Raw err.message used to be returned to the client, leaking internals; and a
// multer LIMIT_FILE_SIZE arrives here with no `.status`, so an oversized upload
// answered 500 "File too large" instead of 413.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err);

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "The uploaded file is too large." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "The request body is too large." });
  }
  if (err?.status === 400 && err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body." });
  }

  const status = typeof err?.status === "number" ? err.status : 500;
  // Only a message we set deliberately (4xx) is safe to echo back.
  const message =
    status < 500 && typeof err?.message === "string"
      ? err.message
      : "An internal server error occurred.";
  return res.status(status).json({ error: message });
});

// Start Server.
//
// Guarded so `import app from "./index"` in a test does not bind a port. The
// production entry (`node dist/index.js`) and `ts-node-dev src/index.ts` are
// both the main module, so this is unchanged for them.
function startServer() {
  httpServer.listen(PORT, async () => {
    console.log(`Exam System Backend Server listening on port ${PORT}`);
    console.log(`API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`WebSocket Server: ws://localhost:${PORT}`);
    if (frontendDist) {
      console.log(`Public Web Application ready on http://localhost:${PORT}`);
    }

    // Print where persistent state actually lives, resolved to absolute paths.
    //
    // Nobody has yet confirmed that a Railway redeploy preserves these (see
    // CURRENT_STATUS.md). Both must be on a mounted volume: the container
    // filesystem is replaced on every deploy, so if either path is not backed
    // by one, every candidate, result and recording is destroyed on the next
    // push. Prisma resolves a relative SQLite path against the schema
    // directory, not the working directory -- `file:./dev.db` is
    // prisma/dev.db. Getting this wrong is how a volume ends up mounted at
    // the wrong path.
    const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
    const dbPath = dbUrl.startsWith("file:")
      ? path.resolve(__dirname, "../prisma", dbUrl.slice("file:".length))
      : dbUrl;
    console.log(`Database:  ${dbPath}`);
    console.log(`Uploads:   ${uploadsDir}`);
    console.log("Both paths must be on a persistent volume, or a redeploy wipes them.");

    // Bootstrap the database with questions, settings and admin accounts if empty
    const { bootstrapDatabase } = await import("./config/bootstrap");
    await bootstrapDatabase();
  });
}

if (require.main === module) {
  startServer();
}

/**
 * Process-level safety net.
 *
 * There was none. Combined with `restartPolicyMaxRetries: 10` in railway.json,
 * a repeatable request that crashed the process would exhaust the restart
 * budget and leave the service down. Log and keep serving; a crash loop helps
 * nobody mid-exam.
 */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// Railway sends SIGTERM on redeploy. Finish in-flight requests, close sockets
// and release the database handle instead of being killed mid-write.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down.`);

  io.close();
  httpServer.close(async () => {
    try {
      const { prisma } = await import("./config/db");
      await prisma.$disconnect();
    } catch (err) {
      console.error("Error closing the database connection:", err);
    }
    process.exit(0);
  });

  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
