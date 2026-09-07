import { Router, Request, Response, NextFunction } from "express";
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
    const ext = ".webm"; // the frontend only ever records webm; never trust originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `proctor-video-${uniqueSuffix}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for full exam session
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("video/"));
  },
});

// Multer Storage Configuration for Snapshots
const SNAPSHOT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const snapshotStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, snapshotsDir);
  },
  filename: (_req, file, cb) => {
    // Derived from the mime type, never from originalname. Taking the caller's
    // extension let an unauthenticated POST store `.html` or `.svg` and — with
    // the old public /uploads mount — have it served executable from this
    // app's own origin. The video path above already got this right.
    const ext = SNAPSHOT_EXTENSIONS[file.mimetype] || ".jpg";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `snapshot-${uniqueSuffix}${ext}`);
  },
});

const snapshotUpload = multer({
  storage: snapshotStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    cb(null, Boolean(SNAPSHOT_EXTENSIONS[file.mimetype]));
  },
});

/**
 * Both uploads are candidate-facing, so they cannot take an admin token — but
 * they were fully anonymous, which meant anyone on the internet could write
 * 200 MB per request into the uploads volume forever. An open sitting is the
 * cheapest proof that the caller is a candidate mid-exam.
 */
async function requireOpenSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.query.sessionId || req.headers["x-exam-session"];
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "An exam session is required to upload." });
  }
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session || session.attemptId) {
    return res.status(403).json({ error: "No open exam session for this upload." });
  }
  return next();
}

// POST /api/proctor/upload-video
router.post("/upload-video", requireOpenSession, videoUpload.single("video"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided." });
    }

    const filename = req.file.filename;

    // The upload used to accept a free-form `attemptId` and write
    // `videoFilename` onto whatever attempt it named, letting an anonymous
    // caller replace another candidate's proctoring evidence. It was also
    // dead: the upload happens before the attempt exists, so the id never
    // matched. The submit payload carries `videoFilename` and links it.

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
router.post("/upload-snapshot", requireOpenSession, snapshotUpload.single("photo"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const filename = req.file.filename;
    return res.status(200).json({
      success: true,
      filename,
      url: `/api/proctor/snapshot/${filename}`,
    });
  } catch (error) {
    console.error("Snapshot upload error:", error);
    return res.status(500).json({ error: "Failed to save photo snapshot." });
  }
});

// GET /api/proctor/snapshot/:filename - Serve an identity snapshot (Admin)
//
// These used to be served by `express.static("/uploads")` with no auth at all,
// so a candidate's webcam still was a public URL and the admin-only video
// route below could be bypassed via the same directory.
router.get("/snapshot/:filename", authenticateAdmin, (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const snapshotPath = path.join(snapshotsDir, filename);
    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ error: "Snapshot not found." });
    }
    return res.sendFile(snapshotPath);
  } catch (error) {
    console.error("Snapshot read error:", error);
    return res.status(500).json({ error: "Failed to read the snapshot." });
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

    const downloadName = (req.query.name as string) || filename;
    return res.download(videoPath, downloadName);
  } catch (error) {
    console.error("Video download error:", error);
    return res.status(500).json({ error: "Failed to download video." });
  }
});

export default router;

