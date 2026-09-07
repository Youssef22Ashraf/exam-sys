import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables before config/env reads them
dotenv.config();

import { CORS_ORIGIN } from "./config/env";

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

io.on("connection", (socket) => {
  console.log("🔌 [Socket.io] Client connected:", socket.id);

  // When candidate switches tab or triggers warning
  socket.on("candidate:warning", (payload) => {
    console.log("⚠️ [Proctor Warning]:", payload);
    io.emit("admin:candidate_warning", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  // When candidate starts exam
  socket.on("candidate:started", (payload) => {
    console.log("📝 [Candidate Started]:", payload);
    io.emit("admin:candidate_started", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  // When candidate finishes exam
  socket.on("candidate:submitted", (payload) => {
    console.log("🎉 [Exam Submitted]:", payload);
    io.emit("admin:exam_submitted", {
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

// Static directory for uploaded proctoring snapshots and recordings
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Serve static frontend SPA bundle in production
const candidateFrontendPaths = [
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(__dirname, "../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
];
const frontendDist = candidateFrontendPaths.find((p) => fs.existsSync(p));
if (frontendDist) {
  console.log(`📦 Serving frontend static bundle from: ${frontendDist}`);
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
  console.log(`🚀 Exam System Backend Server listening on port ${PORT}`);
  console.log(`📡 API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket Server: ws://localhost:${PORT}`);
  console.log(`🔒 Static Uploads: http://localhost:${PORT}/uploads`);
  if (frontendDist) {
    console.log(`🌐 Public Web Application ready on http://localhost:${PORT}`);
  }

  // Automatically bootstrap database with questions, settings & admin credentials if empty
  const { bootstrapDatabase } = await import("./config/bootstrap");
  await bootstrapDatabase();
});

export default app;
