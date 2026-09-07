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

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: CORS_ORIGIN !== "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "An internal server error occurred.",
  });
});

// Start Server
httpServer.listen(PORT, async () => {
  console.log(`Exam System Backend Server listening on port ${PORT}`);
  console.log(`API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`WebSocket Server: ws://localhost:${PORT}`);
  if (frontendDist) {
    console.log(`Public Web Application ready on http://localhost:${PORT}`);
  }

  // Automatically bootstrap database with questions, settings & admin credentials if empty
  const { bootstrapDatabase } = await import("./config/bootstrap");
  await bootstrapDatabase();
});

export default app;
