import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";
import { findActiveCooldown } from "../services/cooldown";
import { sendExamCompletionAlert } from "../services/emailService";
import { validateExamineeEmail } from "../services/validation";
import { validateCandidateIdentity } from "../services/candidateIdentity";
import { scoreExam } from "../services/scoring";
import {
  startSession,
  consumeSession,
  closeSession,
  deriveProctoringStatus,
} from "../services/examSession";

const router = Router();

// POST /api/exam/start - Open a server-owned sitting.
//
// The returned id is what makes the exam clock and the warning count the
// server's rather than the client's. Required by POST /submit.
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { candidateEmail, companyId } = req.body;

    const emailCheck = validateExamineeEmail(candidateEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.message });
    }

    const session = await startSession(candidateEmail, companyId || "");
    return res.status(201).json({
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
    });
  } catch (error) {
    console.error("Start exam session error:", error);
    return res.status(500).json({ error: "Failed to start the exam session." });
  }
});

// POST /api/exam/submit - Submit candidate exam & evaluate server-side
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateEmail,
      companyId,
      answers = {},
      // timeSpentSeconds, tabSwitches and proctoringStatus are NOT read from
      // the body any more — the server derives all three from the session.
      sessionId,
      tabSwitches: clientTabSwitches = 0,
      candidatePhoto,
      hasVideoRecording = false,
      videoFilename,
    } = req.body;

    if (!candidateName || !candidateEmail) {
      return res
        .status(400)
        .json({ error: "Candidate name and email are required." });
    }

    // Strict Email Format Check
    const emailCheck = validateExamineeEmail(candidateEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.message });
    }

    // Strict 1-to-1 Candidate Identity Check
    const idCheck = await validateCandidateIdentity(
      candidateName,
      candidateEmail,
      companyId || "N/A"
    );
    if (idCheck.conflict) {
      return res.status(400).json({ error: idCheck.message });
    }

    // Sanitize videoFilename & candidatePhoto
    if (videoFilename !== undefined && videoFilename !== null) {
      if (typeof videoFilename !== "string" || !/^[\w.-]+\.webm$/.test(videoFilename)) {
        return res.status(400).json({ error: "Invalid videoFilename." });
      }
    }
    if (candidatePhoto !== undefined && candidatePhoto !== null) {
      if (typeof candidatePhoto !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(candidatePhoto)) {
        return res.status(400).json({ error: "Invalid candidatePhoto." });
      }
    }

    // 0. The registration screen checks this too, but a client that skips
    //    it must not be able to submit inside the 48-hour window.
    const cooldown = await findActiveCooldown(
      String(candidateEmail).trim().toLowerCase(),
      String(companyId || "").trim()
    );
    if (cooldown) {
      return res.status(403).json({
        error: "COOLDOWN_ACTIVE",
        message: `A submission for this candidate exists within the last 48 hours. Next attempt allowed at ${cooldown.nextAttemptAvailableAt}.`,
        ...cooldown,
      });
    }

    // 1. Fetch questions to evaluate score on the server
    const questions = await prisma.question.findMany({
      orderBy: { id: "asc" },
    });

    if (questions.length === 0) {
      return res.status(500).json({ error: "No exam questions found in database." });
    }

    // 2. Fetch pass threshold from settings, then score (services/scoring.ts)
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    const passThreshold = settings?.passingPercentage ?? 70;

    // 2b. Validate the sitting and take the server's own figures from it.
    //     This is what stops a client posting `tabSwitches: 0` after alt-tabbing
    //     twenty times, or submitting an hour after a 30-minute exam began.
    const session = await consumeSession(
      sessionId,
      String(candidateEmail),
      settings?.durationMinutes ?? 30
    );
    if (!session.ok) {
      return res.status(session.status).json({
        error: session.error,
        message: session.message,
      });
    }

    const timeSpentSeconds = session.timeSpentSeconds;
    // The client count is a floor, not the truth: it can only ever raise the
    // number, never lower what the server observed on the socket feed.
    const tabSwitches = Math.max(
      Number(clientTabSwitches) || 0,
      session.serverWarnings
    );
    const proctoringStatus = deriveProctoringStatus(
      tabSwitches,
      Boolean(hasVideoRecording)
    );

    const {
      partAScore,
      partATotal,
      partBScore,
      partBTotal,
      score,
      totalQuestions,
      percentage,
      isPassed,
    } = scoreExam(questions, answers, passThreshold);

    const trimmedEmail = candidateEmail.trim().toLowerCase();
    const submissionTime = new Date();

    // 3 & 4. Atomically upsert candidate stats and insert attempt
    let candidate: { id: string; name: string; email: string; companyId: string };
    let attemptNumber = 1;

    const attempt = await prisma.$transaction(async (tx) => {
      const existing = await tx.candidate.findUnique({
        where: { email: trimmedEmail },
      });

      if (!existing) {
        candidate = await tx.candidate.create({
          data: {
            name: candidateName.trim(),
            email: trimmedEmail,
            companyId: companyId ? companyId.trim() : "N/A",
            status: "Completed",
            totalAttempts: 1,
            highestScore: score,
            latestScore: score,
            lastAttemptAt: submissionTime,
          },
        });
        attemptNumber = 1;
      } else {
        const highest = Math.max(existing.highestScore ?? 0, score);
        const newAttemptsCount = (existing.totalAttempts || 0) + 1;
        candidate = await tx.candidate.update({
          where: { id: existing.id },
          data: {
            status: "Completed",
            totalAttempts: newAttemptsCount,
            latestScore: score,
            highestScore: highest,
            lastAttemptAt: submissionTime,
          },
        });
        attemptNumber = newAttemptsCount;
      }

      // Save Attempt Record
      return tx.examAttempt.create({
        data: {
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          companyId: candidate.companyId,
          submittedAt: submissionTime,
          score,
          totalQuestions,
          percentage,
          isPassed,
          timeSpentSeconds: Number(timeSpentSeconds),
          partAScore,
          partATotal,
          partBScore,
          partBTotal,
          answers: JSON.stringify(answers),
          tabSwitches: Number(tabSwitches),
          proctoringStatus,
          candidatePhoto: candidatePhoto || null,
          hasVideoRecording: Boolean(hasVideoRecording),
          videoFilename: videoFilename || null,
          attemptNumber,
        },
      });
    });

    // 4b. Spend the sitting so the same session cannot be submitted twice.
    await closeSession(session.sessionId, attempt.id);

    // 5. Asynchronous Email Alert (non-blocking)
    sendExamCompletionAlert({
      candidateName: candidate!.name,
      candidateEmail: candidate!.email,
      companyId: candidate!.companyId,
      score,
      totalQuestions,
      percentage,
      isPassed,
      timeSpentSeconds: Number(timeSpentSeconds),
      proctoringStatus,
      tabSwitches: Number(tabSwitches),
      attemptNumber,
    }).catch((err) => console.error("Email notification failed:", err));

    return res.status(201).json({
      success: true,
      result: {
        id: attempt.id,
        candidateId: attempt.candidateId,
        candidateName: attempt.candidateName,
        candidateEmail: attempt.candidateEmail,
        companyId: attempt.companyId,
        submittedAt: attempt.submittedAt.toISOString(),
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        timeSpentSeconds: attempt.timeSpentSeconds,
        partAScore: attempt.partAScore,
        partATotal: attempt.partATotal,
        partBScore: attempt.partBScore,
        partBTotal: attempt.partBTotal,
        answers: JSON.parse(attempt.answers),
        tabSwitches: attempt.tabSwitches,
        proctoringStatus: attempt.proctoringStatus,
        candidatePhoto: attempt.candidatePhoto,
        hasVideoRecording: attempt.hasVideoRecording,
        videoFilename: attempt.videoFilename,
        attemptNumber: attempt.attemptNumber || attemptNumber,
      },
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    return res.status(500).json({ error: "Failed to submit and evaluate exam." });
  }
});

// GET /api/exam/results - List results for Admin Dashboard
router.get("/results", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status === "PASSED") {
      where.isPassed = true;
    } else if (status === "FAILED") {
      where.isPassed = false;
    }

    if (search && typeof search === "string") {
      where.OR = [
        { candidateName: { contains: search } },
        { candidateEmail: { contains: search } },
        { companyId: { contains: search } },
      ];
    }

    const attempts = await prisma.examAttempt.findMany({
      where,
      orderBy: { submittedAt: "desc" },
    });

    const formatted = attempts.map((a) => ({
      id: a.id,
      candidateId: a.candidateId,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      companyId: a.companyId,
      submittedAt: a.submittedAt.toISOString(),
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      isPassed: a.isPassed,
      timeSpentSeconds: a.timeSpentSeconds,
      partAScore: a.partAScore,
      partATotal: a.partATotal,
      partBScore: a.partBScore,
      partBTotal: a.partBTotal,
      answers: JSON.parse(a.answers || "{}"),
      tabSwitches: a.tabSwitches,
      proctoringStatus: a.proctoringStatus,
      candidatePhoto: a.candidatePhoto,
      hasVideoRecording: a.hasVideoRecording,
      videoFilename: a.videoFilename,
      attemptNumber: a.attemptNumber || 1,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Fetch exam results error:", error);
    return res.status(500).json({ error: "Failed to retrieve exam results." });
  }
});

// GET /api/exam/results/:id - Single attempt details
router.get("/results/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const a = await prisma.examAttempt.findUnique({
      where: { id },
    });

    if (!a) {
      return res.status(404).json({ error: "Exam attempt not found." });
    }

    return res.json({
      id: a.id,
      candidateId: a.candidateId,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      companyId: a.companyId,
      submittedAt: a.submittedAt.toISOString(),
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      isPassed: a.isPassed,
      timeSpentSeconds: a.timeSpentSeconds,
      partAScore: a.partAScore,
      partATotal: a.partATotal,
      partBScore: a.partBScore,
      partBTotal: a.partBTotal,
      answers: JSON.parse(a.answers || "{}"),
      tabSwitches: a.tabSwitches,
      proctoringStatus: a.proctoringStatus,
      candidatePhoto: a.candidatePhoto,
      hasVideoRecording: a.hasVideoRecording,
      videoFilename: a.videoFilename,
      attemptNumber: a.attemptNumber || 1,
    });
  } catch (error) {
    console.error("Fetch attempt error:", error);
    return res.status(500).json({ error: "Failed to fetch attempt details." });
  }
});

// GET /api/exam/results/export/csv - Export CSV file for Excel
router.get("/export/csv", authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const attempts = await prisma.examAttempt.findMany({
      orderBy: { submittedAt: "desc" },
    });

    const headers = [
      "Attempt ID",
      "Candidate Name",
      "Email",
      "Company ID",
      "Submission Date",
      "Score",
      "Total",
      "Percentage",
      "Status",
      "Time Spent (s)",
      "Part A Score",
      "Part B Score",
      "Proctoring",
      "Tab Switches",
    ];

    const rows = attempts.map((a) => [
      `"${a.id}"`,
      `"${a.candidateName.replace(/"/g, '""')}"`,
      `"${a.candidateEmail.replace(/"/g, '""')}"`,
      `"${a.companyId}"`,
      `"${a.submittedAt.toISOString()}"`,
      a.score,
      a.totalQuestions,
      `${a.percentage.toFixed(1)}%`,
      a.isPassed ? "PASSED" : "FAILED",
      a.timeSpentSeconds,
      `${a.partAScore}/${a.partATotal}`,
      `${a.partBScore}/${a.partBTotal}`,
      `"${a.proctoringStatus}"`,
      a.tabSwitches,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\r\n"
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Assessment_Results_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    return res.send(csvContent);
  } catch (error) {
    console.error("CSV export error:", error);
    return res.status(500).json({ error: "Failed to export results." });
  }
});

// DELETE /api/exam/results/:id - Delete attempt (Admin)
router.delete("/results/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.examAttempt.delete({
      where: { id },
    });
    return res.json({ success: true, message: "Attempt deleted successfully." });
  } catch (error) {
    console.error("Delete attempt error:", error);
    return res.status(500).json({ error: "Failed to delete attempt record." });
  }
});

export default router;
