import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";
import { validateExamineeEmail } from "../services/validation";
import {
  LECTURES,
  getLecturesDirectory,
  convertSrtToVtt,
  calculateLectureCompletion,
  LectureItem,
} from "../config/lecturesData";
import { io } from "../index";

const router = Router();

function pipeWithErrorHandling(
  stream: fs.ReadStream,
  res: Response,
  label: string
) {
  stream.on("error", (err) => {
    console.error(`Stream error while sending ${path.basename(label)}:`, err);
    res.destroy();
  });
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

function getSlideImagesCount(lectureId: string, lecturesDir: string): number {
  try {
    const dir = path.join(lecturesDir, "slides_images", lectureId);
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png")).length;
  } catch {
    return 0;
  }
}

// GET /api/lectures - Public list of available lectures
router.get("/", (_req: Request, res: Response) => {
  const lecturesDir = getLecturesDirectory();

  const list = LECTURES.map((lec) => {
    const videoPath = path.join(lecturesDir, lec.videoFilename);
    const pptxPath = path.join(lecturesDir, lec.pptxFilename);
    const srtPath = lec.srtFilename ? path.join(lecturesDir, lec.srtFilename) : null;
    const slideImagesCount = getSlideImagesCount(lec.id, lecturesDir);

    return {
      id: lec.id,
      title: lec.title,
      subtitle: lec.subtitle,
      category: lec.category,
      docRef: lec.docRef,
      policyRef: lec.policyRef,
      description: lec.description,
      durationSeconds: lec.durationSeconds,
      durationFormatted: lec.durationFormatted,
      slideCount: slideImagesCount > 0 ? slideImagesCount : lec.slideCount,
      slideImagesCount,
      hasSlideImages: slideImagesCount > 0,
      keyTopics: lec.keyTopics,
      outline: lec.outline,
      slides: lec.slides,
      checkpoints: lec.checkpoints,
      hasVideo: fs.existsSync(videoPath),
      hasSlides: fs.existsSync(pptxPath),
      hasSubtitles: Boolean(srtPath && fs.existsSync(srtPath)),
    };
  });

  return res.json(list);
});

// GET /api/lectures/user/progress - Get candidate's checklist & completion progress across all lectures
router.get("/user/progress", async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string)?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    const progress = await prisma.lectureProgress.findMany({
      where: { candidateEmail: email },
    });
    return res.json({ progress });
  } catch (error) {
    console.error("Error fetching user progress:", error);
    return res.status(500).json({ error: "Failed to fetch user progress." });
  }
});

// POST /api/lectures/checklist - Update candidate's checklist items and progress
router.post("/checklist", async (req: Request, res: Response) => {
  try {
    const { name, email, companyId, department, lectureId, completedItems, action } = req.body;
    if (!email || !lectureId) {
      return res.status(400).json({ error: "Email and lectureId are required." });
    }
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = name ? String(name).trim() : "Participant";
    const trimmedCompanyId = companyId ? String(companyId).trim().toUpperCase() : "N/A";
    const trimmedDepartment = department ? String(department).trim() : "General";
    const lecture = LECTURES.find((l) => l.id === lectureId);
    const lectureTitle = lecture ? lecture.title : String(lectureId);
    const items: string[] = Array.isArray(completedItems) ? completedItems : [];

    const completionPercent = calculateLectureCompletion(items, String(lectureId));
    const isVideoDone = items.includes("video");
    const isSlidesDone = items.includes("slides");
    const isDownloadDone = items.includes("download");
    const isCheckpointsDone = (lecture?.checkpoints && lecture.checkpoints.length > 0)
      ? lecture.checkpoints.every((cp) => items.includes(cp.id))
      : false;

    const progress = await prisma.lectureProgress.upsert({
      where: {
        candidateEmail_lectureId: {
          candidateEmail: trimmedEmail,
          lectureId: String(lectureId),
        },
      },
      update: {
        candidateName: trimmedName,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        videoCompleted: isVideoDone,
        slidesViewed: isSlidesDone,
        slidesDownloaded: isDownloadDone,
        checkpointsFinished: isCheckpointsDone,
        completionPercent,
        completedItems: JSON.stringify(items),
        lastAccessedAt: new Date(),
      },
      create: {
        candidateEmail: trimmedEmail,
        candidateName: trimmedName,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        lectureId: String(lectureId),
        videoCompleted: isVideoDone,
        slidesViewed: isSlidesDone,
        slidesDownloaded: isDownloadDone,
        checkpointsFinished: isCheckpointsDone,
        completionPercent,
        completedItems: JSON.stringify(items),
      },
    });

    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";
    const userAgent = (req.headers["user-agent"] as string) || "Unknown Device";

    await prisma.lectureAttendance.create({
      data: {
        candidateName: trimmedName,
        candidateEmail: trimmedEmail,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        lectureId: String(lectureId),
        lectureTitle,
        action: action || "CHECKLIST_UPDATED",
        completionPercent,
        completedItems: JSON.stringify(items),
        ipAddress,
        userAgent,
      },
    });

    try {
      io.to("admins").emit("admin:lecture_checklist", {
        candidateName: trimmedName,
        candidateEmail: trimmedEmail,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        lectureId: String(lectureId),
        lectureTitle,
        completionPercent,
        completedItems: items,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Socket broadcast error:", err);
    }

    return res.json({ success: true, progress, completionPercent });
  } catch (error) {
    console.error("Error updating checklist:", error);
    return res.status(500).json({ error: "Failed to update checklist." });
  }
});

// GET /api/lectures/:id - Get specific lecture details with outline and full slides
router.get("/:id", (req: Request, res: Response) => {
  const lecture = LECTURES.find((l) => l.id === req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found." });
  }

  const lecturesDir = getLecturesDirectory();
  const videoPath = path.join(lecturesDir, lecture.videoFilename);
  const pptxPath = path.join(lecturesDir, lecture.pptxFilename);
  const srtPath = lecture.srtFilename ? path.join(lecturesDir, lecture.srtFilename) : null;
  const slideImagesCount = getSlideImagesCount(lecture.id, lecturesDir);

  return res.json({
    ...lecture,
    slideCount: slideImagesCount > 0 ? slideImagesCount : lecture.slideCount,
    slideImagesCount,
    hasSlideImages: slideImagesCount > 0,
    hasVideo: fs.existsSync(videoPath),
    hasSlides: fs.existsSync(pptxPath),
    hasSubtitles: Boolean(srtPath && fs.existsSync(srtPath)),
  });
});

// POST /api/lectures/access - Register attendance / portal entry
router.post("/access", async (req: Request, res: Response) => {
  try {
    const { name, email, companyId, department, lectureId, action } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Full Name is required." });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Corporate Email is required." });
    }
    if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
      return res.status(400).json({ error: "Company ID is required." });
    }
    if (!department || typeof department !== "string" || !department.trim()) {
      return res.status(400).json({ error: "Department is required." });
    }

    const emailCheck = validateExamineeEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.message });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCompanyId = companyId.trim().toUpperCase();
    const trimmedDepartment = department.trim();

    const lecture = lectureId ? LECTURES.find((l) => l.id === lectureId) : null;
    const lectureTitle = lecture ? lecture.title : "Training & Lectures Portal";
    const assignedLectureId = lecture ? lecture.id : (lectureId || "portal");
    const assignedAction = action || "PORTAL_ACCESS";

    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";
    const userAgent = (req.headers["user-agent"] as string) || "Unknown Device";

    const record = await prisma.lectureAttendance.create({
      data: {
        candidateName: trimmedName,
        candidateEmail: trimmedEmail,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        lectureId: assignedLectureId,
        lectureTitle,
        action: assignedAction,
        watchDurationSeconds: 0,
        maxProgressPercent: 0,
        ipAddress,
        userAgent,
      },
    });

    // Also update or record Candidate record department if candidate exists
    try {
      await prisma.candidate.upsert({
        where: { email: trimmedEmail },
        update: { department: trimmedDepartment },
        create: {
          name: trimmedName,
          email: trimmedEmail,
          companyId: trimmedCompanyId,
          department: trimmedDepartment,
          status: "Registered",
        },
      });
    } catch (err) {
      console.warn("Could not sync candidate department:", err);
    }

    // Real-time broadcast to admin room
    try {
      io.to("admins").emit("admin:lecture_access", {
        attendanceId: record.id,
        candidateName: trimmedName,
        candidateEmail: trimmedEmail,
        companyId: trimmedCompanyId,
        department: trimmedDepartment,
        lectureId: assignedLectureId,
        lectureTitle,
        action: assignedAction,
        timestamp: record.createdAt.toISOString(),
      });
    } catch (err) {
      console.warn("Socket broadcast error:", err);
    }

    return res.status(201).json({
      success: true,
      attendanceId: record.id,
      record,
    });
  } catch (error) {
    console.error("Error logging lecture access:", error);
    return res.status(500).json({ error: "Failed to record lecture access." });
  }
});

// POST /api/lectures/track - Track video watching progress or slide interaction
router.post("/track", async (req: Request, res: Response) => {
  try {
    const {
      attendanceId,
      name,
      email,
      companyId,
      department,
      lectureId,
      action,
      watchDurationSeconds,
      maxProgressPercent,
    } = req.body;

    if (!email || !companyId || !department || !lectureId) {
      return res.status(400).json({ error: "Missing required tracking parameters." });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedCompanyId = String(companyId).trim().toUpperCase();
    const trimmedDepartment = String(department).trim();
    const trimmedName = name ? String(name).trim() : "Participant";
    const lecture = LECTURES.find((l) => l.id === lectureId);
    const lectureTitle = lecture ? lecture.title : String(lectureId);

    const safeDuration = Math.max(0, Math.round(Number(watchDurationSeconds) || 0));
    const safeProgress = Math.min(100, Math.max(0, Number(maxProgressPercent) || 0));

    let record;
    if (attendanceId) {
      const existing = await prisma.lectureAttendance.findUnique({
        where: { id: attendanceId },
      });
      if (existing) {
        record = await prisma.lectureAttendance.update({
          where: { id: attendanceId },
          data: {
            watchDurationSeconds: Math.max(existing.watchDurationSeconds, safeDuration),
            maxProgressPercent: Math.max(existing.maxProgressPercent, safeProgress),
            action: action || existing.action,
          },
        });
      }
    }

    if (!record) {
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";
      const userAgent = (req.headers["user-agent"] as string) || "Unknown Device";

      record = await prisma.lectureAttendance.create({
        data: {
          candidateName: trimmedName,
          candidateEmail: trimmedEmail,
          companyId: trimmedCompanyId,
          department: trimmedDepartment,
          lectureId: String(lectureId),
          lectureTitle,
          action: action || "VIDEO_WATCHED",
          watchDurationSeconds: safeDuration,
          maxProgressPercent: safeProgress,
          ipAddress,
          userAgent,
        },
      });
    }

    // If watching progress reaches >= 80%, auto-update videoCompleted in LectureProgress
    if (safeProgress >= 80) {
      try {
        const existingProg = await prisma.lectureProgress.findUnique({
          where: {
            candidateEmail_lectureId: {
              candidateEmail: trimmedEmail,
              lectureId: String(lectureId),
            },
          },
        });
        const currentItems: string[] = existingProg?.completedItems
          ? JSON.parse(existingProg.completedItems)
          : [];
        if (!currentItems.includes("video")) {
          currentItems.push("video");
          const completionPercent = calculateLectureCompletion(currentItems, String(lectureId));
          await prisma.lectureProgress.upsert({
            where: {
              candidateEmail_lectureId: {
                candidateEmail: trimmedEmail,
                lectureId: String(lectureId),
              },
            },
            update: {
              videoCompleted: true,
              completionPercent,
              completedItems: JSON.stringify(currentItems),
              lastAccessedAt: new Date(),
            },
            create: {
              candidateEmail: trimmedEmail,
              candidateName: trimmedName,
              companyId: trimmedCompanyId,
              department: trimmedDepartment,
              lectureId: String(lectureId),
              videoCompleted: true,
              completionPercent,
              completedItems: JSON.stringify(currentItems),
            },
          });
        }
      } catch (e) {
        console.warn("Could not auto-mark video completed:", e);
      }
    }

    return res.json({ success: true, record });
  } catch (error) {
    console.error("Error updating lecture progress:", error);
    return res.status(500).json({ error: "Failed to update tracking." });
  }
});

// GET /api/lectures/:id/video - Stream lecture video with HTTP 206 Range headers
router.get("/:id/video", (req: Request, res: Response) => {
  try {
    const lecture = LECTURES.find((l) => l.id === req.params.id);
    if (!lecture) {
      return res.status(404).json({ error: "Lecture not found." });
    }

    const lecturesDir = getLecturesDirectory();
    const videoPath = path.join(lecturesDir, lecture.videoFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found for this lecture." });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      let start: number;
      let requestedEnd: number;

      if (parts[0] === "" && parts[1]) {
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
        "Content-Type": "video/mp4",
      });
      return pipeWithErrorHandling(file, res, videoPath);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      });
      const file = fs.createReadStream(videoPath);
      return pipeWithErrorHandling(file, res, videoPath);
    }
  } catch (error) {
    console.error("Error streaming lecture video:", error);
    return res.status(500).json({ error: "Could not stream lecture video." });
  }
});

// GET /api/lectures/:id/subtitles - Stream WebVTT subtitles
router.get("/:id/subtitles", (req: Request, res: Response) => {
  try {
    const lecture = LECTURES.find((l) => l.id === req.params.id);
    if (!lecture || !lecture.srtFilename) {
      return res.status(404).send("WEBVTT\n\n");
    }

    const lecturesDir = getLecturesDirectory();
    const srtPath = path.join(lecturesDir, lecture.srtFilename);

    if (!fs.existsSync(srtPath)) {
      return res.status(404).send("WEBVTT\n\n");
    }

    const srtContent = fs.readFileSync(srtPath, "utf8");
    const vttContent = convertSrtToVtt(srtContent);

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(vttContent);
  } catch (error) {
    console.error("Error serving subtitles:", error);
    return res.status(500).send("WEBVTT\n\n");
  }
});

// GET /api/lectures/:id/slides - Download PPTX Presentation file with tracking
router.get("/:id/slides", async (req: Request, res: Response) => {
  try {
    const lecture = LECTURES.find((l) => l.id === req.params.id);
    if (!lecture) {
      return res.status(404).json({ error: "Lecture not found." });
    }

    const lecturesDir = getLecturesDirectory();
    const pptxPath = path.join(lecturesDir, lecture.pptxFilename);

    if (!fs.existsSync(pptxPath)) {
      return res.status(404).json({ error: "Presentation file not found." });
    }

    const { name, email, companyId, department } = req.query;
    if (email && companyId && department) {
      try {
        const trimmedEmail = String(email).trim().toLowerCase();
        const trimmedName = String(name || "Participant").trim();
        const trimmedCompanyId = String(companyId).trim().toUpperCase();
        const trimmedDepartment = String(department).trim();

        const ipAddress =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
          req.socket.remoteAddress ||
          "127.0.0.1";
        const userAgent = (req.headers["user-agent"] as string) || "Unknown Device";

        await prisma.lectureAttendance.create({
          data: {
            candidateName: trimmedName,
            candidateEmail: trimmedEmail,
            companyId: trimmedCompanyId,
            department: trimmedDepartment,
            lectureId: lecture.id,
            lectureTitle: lecture.title,
            action: "SLIDES_DOWNLOADED",
            watchDurationSeconds: 0,
            maxProgressPercent: 0,
            ipAddress,
            userAgent,
          },
        });

        // Also mark download in LectureProgress
        const existingProg = await prisma.lectureProgress.findUnique({
          where: {
            candidateEmail_lectureId: {
              candidateEmail: trimmedEmail,
              lectureId: lecture.id,
            },
          },
        });
        const currentItems: string[] = existingProg?.completedItems
          ? JSON.parse(existingProg.completedItems)
          : [];
        if (!currentItems.includes("download")) {
          currentItems.push("download");
          const completionPercent = calculateLectureCompletion(currentItems, lecture.id);
          await prisma.lectureProgress.upsert({
            where: {
              candidateEmail_lectureId: {
                candidateEmail: trimmedEmail,
                lectureId: lecture.id,
              },
            },
            update: {
              slidesDownloaded: true,
              completionPercent,
              completedItems: JSON.stringify(currentItems),
              lastAccessedAt: new Date(),
            },
            create: {
              candidateEmail: trimmedEmail,
              candidateName: trimmedName,
              companyId: trimmedCompanyId,
              department: trimmedDepartment,
              lectureId: lecture.id,
              slidesDownloaded: true,
              completionPercent,
              completedItems: JSON.stringify(currentItems),
            },
          });
        }
      } catch (logErr) {
        console.warn("Could not log slide download event:", logErr);
      }
    }

    const cleanFilename = path.basename(lecture.pptxFilename).trim();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(cleanFilename)}"`
    );
    const fileStream = fs.createReadStream(pptxPath);
    return pipeWithErrorHandling(fileStream, res, pptxPath);
  } catch (error) {
    console.error("Error downloading slides:", error);
    return res.status(500).json({ error: "Could not download slides." });
  }
});

// GET /api/lectures/:id/slides-images/:slideNum - Serve authentic slide HD PNG image
router.get("/:id/slides-images/:slideNum", (req: Request, res: Response) => {
  try {
    const lecture = LECTURES.find((l) => l.id === req.params.id);
    if (!lecture) {
      return res.status(404).json({ error: "Lecture not found." });
    }

    const slideNum = parseInt(req.params.slideNum, 10);
    if (isNaN(slideNum) || slideNum < 1) {
      return res.status(400).json({ error: "Invalid slide number." });
    }

    const lecturesDir = getLecturesDirectory();
    const slidePath = path.join(
      lecturesDir,
      "slides_images",
      lecture.id,
      `slide_${slideNum}.png`
    );

    if (!fs.existsSync(slidePath)) {
      return res.status(404).json({ error: "Slide image not found." });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    const stream = fs.createReadStream(slidePath);
    return pipeWithErrorHandling(stream, res, slidePath);
  } catch (error) {
    console.error("Error serving slide image:", error);
    return res.status(500).json({ error: "Could not serve slide image." });
  }
});

// GET /api/lectures/admin/attendance - Admin: Get attendance logs, statistics & user progress
router.get("/admin/attendance", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { search, department, lectureId, action } = req.query as {
      search?: string;
      department?: string;
      lectureId?: string;
      action?: string;
    };

    const where: Record<string, unknown> = {};

    if (department && department !== "All") {
      where.department = department;
    }
    if (lectureId && lectureId !== "All") {
      where.lectureId = lectureId;
    }
    if (action && action !== "All") {
      where.action = action;
    }
    if (search) {
      where.OR = [
        { candidateName: { contains: search } },
        { candidateEmail: { contains: search } },
        { companyId: { contains: search } },
        { department: { contains: search } },
      ];
    }

    const [attendanceList, totalCount, allRecords, allProgress] = await Promise.all([
      prisma.lectureAttendance.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.lectureAttendance.count({ where }),
      prisma.lectureAttendance.findMany({
        select: {
          candidateEmail: true,
          department: true,
          lectureId: true,
          action: true,
          watchDurationSeconds: true,
        },
      }),
      prisma.lectureProgress.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Calculate aggregated statistics
    const uniqueAttendees = new Set(allRecords.map((r) => r.candidateEmail)).size;
    const totalWatchSeconds = allRecords.reduce(
      (sum, r) => sum + (r.watchDurationSeconds || 0),
      0
    );

    // Department breakdown
    const deptCounts: Record<string, { count: number; uniqueUsers: Set<string> }> = {};
    for (const r of allRecords) {
      if (!deptCounts[r.department]) {
        deptCounts[r.department] = { count: 0, uniqueUsers: new Set() };
      }
      deptCounts[r.department].count++;
      deptCounts[r.department].uniqueUsers.add(r.candidateEmail);
    }

    const departmentsSummary = Object.entries(deptCounts)
      .map(([name, val]) => ({
        department: name,
        totalEngagements: val.count,
        uniqueUsers: val.uniqueUsers.size,
      }))
      .sort((a, b) => b.totalEngagements - a.totalEngagements);

    const topDepartment = departmentsSummary.length > 0 ? departmentsSummary[0].department : "None";

    // Lecture breakdown
    const lectureCounts: Record<string, { views: number; downloads: number; watchSecs: number }> = {};
    for (const r of allRecords) {
      if (!lectureCounts[r.lectureId]) {
        lectureCounts[r.lectureId] = { views: 0, downloads: 0, watchSecs: 0 };
      }
      if (r.action === "SLIDES_DOWNLOADED") {
        lectureCounts[r.lectureId].downloads++;
      } else {
        lectureCounts[r.lectureId].views++;
      }
      lectureCounts[r.lectureId].watchSecs += r.watchDurationSeconds || 0;
    }

    return res.json({
      attendance: attendanceList,
      totalCount,
      stats: {
        totalAttendees: uniqueAttendees,
        totalEngagements: allRecords.length,
        totalWatchSeconds,
        totalWatchHours: Math.round((totalWatchSeconds / 3600) * 10) / 10,
        topDepartment,
        departments: departmentsSummary,
        lectureBreakdown: lectureCounts,
      },
      userProgress: allProgress,
    });
  } catch (error) {
    console.error("Error fetching lecture attendance:", error);
    return res.status(500).json({ error: "Failed to fetch attendance data." });
  }
});

// GET /api/lectures/admin/export - Export attendance data as Excel-ready CSV with checklist breakdown
router.get("/admin/export", authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const [records, progressList] = await Promise.all([
      prisma.lectureAttendance.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.lectureProgress.findMany(),
    ]);

    // Create lookup map for progress
    const progressMap = new Map<string, (typeof progressList)[0]>();
    for (const p of progressList) {
      progressMap.set(`${p.candidateEmail}_${p.lectureId}`, p);
    }

    const headers = [
      "Attendance ID",
      "Full Name",
      "Corporate Email",
      "Company ID",
      "Department (From Where)",
      "Lecture / Module",
      "Activity / Action",
      "Checklist Completion (%)",
      "Video Watched",
      "Slides Reviewed",
      "Checkpoints Finished",
      "PPTX Downloaded",
      "Completed Checklist Items",
      "Watch Duration (Seconds)",
      "Watch Duration (Formatted)",
      "Max Video Progress (%)",
      "Date & Time",
      "IP Address",
      "Device / User Agent",
    ];

    const formatDuration = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s}s`;
    };

    const rows = records.map((r) => {
      const userProg = progressMap.get(`${r.candidateEmail}_${r.lectureId}`);
      const completionPercent = userProg
        ? Math.round(userProg.completionPercent)
        : Math.round(r.completionPercent || 0);

      const videoDone = userProg?.videoCompleted
        ? "YES"
        : r.maxProgressPercent >= 80
        ? "YES"
        : "NO";
      const slidesDone = userProg?.slidesViewed
        ? "YES"
        : r.action === "SLIDES_VIEWED"
        ? "YES"
        : "NO";
      const checkpointsDone = userProg?.checkpointsFinished ? "YES" : "NO";
      const downloadDone = userProg?.slidesDownloaded
        ? "YES"
        : r.action === "SLIDES_DOWNLOADED"
        ? "YES"
        : "NO";

      const itemsStr = userProg?.completedItems || r.completedItems || "[]";

      return [
        `"${r.id}"`,
        `"${r.candidateName.replace(/"/g, '""')}"`,
        `"${r.candidateEmail.replace(/"/g, '""')}"`,
        `"${r.companyId}"`,
        `"${r.department.replace(/"/g, '""')}"`,
        `"${r.lectureTitle.replace(/"/g, '""')}"`,
        `"${r.action}"`,
        `"${completionPercent}%"`,
        `"${videoDone}"`,
        `"${slidesDone}"`,
        `"${checkpointsDone}"`,
        `"${downloadDone}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        r.watchDurationSeconds,
        `"${formatDuration(r.watchDurationSeconds)}"`,
        `"${Math.round(r.maxProgressPercent)}%"`,
        `"${new Date(r.createdAt).toLocaleString()}"`,
        `"${r.ipAddress || ""}"`,
        `"${(r.userAgent || "").replace(/"/g, '""')}"`,
      ];
    });

    // Prepend UTF-8 BOM (\uFEFF) so Excel natively recognizes Arabic/Unicode and columns
    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    const exportFilename = `lecture_attendance_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportFilename}"`
    );
    return res.send(csvContent);
  } catch (error) {
    console.error("Error exporting attendance CSV:", error);
    return res.status(500).json({ error: "Failed to export attendance CSV." });
  }
});

// DELETE /api/lectures/admin/attendance/:id - Delete an attendance record
router.delete("/admin/attendance/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.lectureAttendance.delete({
      where: { id },
    });
    return res.json({ success: true, message: "Attendance record deleted." });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    return res.status(500).json({ error: "Failed to delete attendance record." });
  }
});

export default router;
