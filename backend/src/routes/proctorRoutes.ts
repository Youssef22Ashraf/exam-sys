import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../config/db";
import { rateLimit } from "../middleware/rateLimit";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// Candidate-facing and unauthenticated, so there is no token to throttle on.
// These were entirely unlimited while doing real database and disk work.
const publicLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

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
router.post("/upload-video", publicLimit, requireOpenSession, videoUpload.single("video"), async (req: Request, res: Response) => {
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
router.post("/upload-snapshot", publicLimit, requireOpenSession, snapshotUpload.single("photo"), async (req: Request, res: Response) => {
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

/**
 * Pipe a file to the response with an error listener attached.
 *
 * A read stream that fails after writeHead emits `error` asynchronously, so it
 * escapes the surrounding try/catch and, with no listener, becomes an
 * unhandled `error` event — which takes the process down. Headers are already
 * sent by then, so the only thing left to do is log and destroy the response.
 */
function pipeWithErrorHandling(
  stream: fs.ReadStream,
  res: Response,
  label: string
): void {
  stream.on("error", (err) => {
    console.error(`Stream error while sending ${path.basename(label)}:`, err);
    res.destroy();
  });
  // Stop reading if the client goes away mid-download.
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

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
      // `parseInt` on the raw header gave NaN for `bytes=abc-`, and `end` was
      // never clamped, so `bytes=99999999-` produced a negative chunk size and
      // an invalid Content-Length. Anything unparseable is refused with a 416.
      const parts = range.replace(/bytes=/, "").split("-");
      let start: number;
      let requestedEnd: number;

      if (parts[0] === "" && parts[1]) {
        // Suffix range: `bytes=-500` means the last 500 bytes.
        const suffix = Number.parseInt(parts[1], 10);
        start = Number.isNaN(suffix) ? NaN : Math.max(0, fileSize - suffix);
        requestedEnd = fileSize - 1;
      } else {
        start = Number.parseInt(parts[0], 10);
        requestedEnd = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
      }

      if (
        Number.isNaN(start) ||
        start < 0 ||
        start >= fileSize ||
        Number.isNaN(requestedEnd)
      ) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).json({ error: "Requested range not satisfiable." });
      }

      const end = Math.min(requestedEnd, fileSize - 1);
      if (end < start) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).json({ error: "Requested range not satisfiable." });
      }

      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/webm",
      });
      return pipeWithErrorHandling(file, res, videoPath);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/webm",
      });
      return pipeWithErrorHandling(fs.createReadStream(videoPath), res, videoPath);
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

    // `?name=` landed in Content-Disposition unvalidated. Keep it to a plain
    // basename so it cannot inject header syntax.
    const requested = typeof req.query.name === "string" ? path.basename(req.query.name) : "";
    const downloadName = /^[\w.\- ]{1,120}$/.test(requested) ? requested : filename;
    return res.download(videoPath, downloadName);
  } catch (error) {
    console.error("Video download error:", error);
    return res.status(500).json({ error: "Failed to download video." });
  }
});

export default router;

