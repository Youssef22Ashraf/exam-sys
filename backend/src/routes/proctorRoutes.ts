import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// Ensure upload directories exist
const uploadBaseDir = path.resolve(__dirname, "../../uploads");
const videosDir = path.join(uploadBaseDir, "videos");
const snapshotsDir = path.join(uploadBaseDir, "snapshots");

if (!fs.existsSync(uploadBaseDir)) fs.mkdirSync(uploadBaseDir, { recursive: true });
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });

// Multer Storage Configuration for Videos
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, videosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `proctor-video-${uniqueSuffix}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for full exam session
});

// Multer Storage Configuration for Snapshots
const snapshotStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, snapshotsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `snapshot-${uniqueSuffix}${ext}`);
  },
});

const snapshotUpload = multer({
  storage: snapshotStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/proctor/upload-video
router.post("/upload-video", videoUpload.single("video"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided." });
    }

    const { attemptId } = req.body;
    const filename = req.file.filename;

    if (attemptId) {
      await prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          hasVideoRecording: true,
          videoFilename: filename,
        },
      });
    }

    return res.status(200).json({
      success: true,
      filename,
      url: `/api/proctor/video/${filename}`,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    return res.status(500).json({ error: "Failed to save video upload." });
  }
});

// POST /api/proctor/upload-snapshot
router.post("/upload-snapshot", snapshotUpload.single("photo"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const filename = req.file.filename;
    return res.status(200).json({
      success: true,
      filename,
      url: `/uploads/snapshots/${filename}`,
    });
  } catch (error) {
    console.error("Snapshot upload error:", error);
    return res.status(500).json({ error: "Failed to save photo snapshot." });
  }
});

// GET /api/proctor/video/:filename - Stream video with HTTP 206 Range headers
router.get("/video/:filename", authenticateAdmin, (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const videoPath = path.join(videosDir, filename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found." });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/webm",
      });
      return file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/webm",
      });
      return fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error("Video streaming error:", error);
    return res.status(500).json({ error: "Failed to stream video." });
  }
});

// GET /api/proctor/download/:filename - Force download
router.get("/download/:filename", authenticateAdmin, (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const videoPath = path.join(videosDir, filename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found." });
    }

    return res.download(videoPath, filename);
  } catch (error) {
    console.error("Video download error:", error);
    return res.status(500).json({ error: "Failed to download video." });
  }
});

export default router;

