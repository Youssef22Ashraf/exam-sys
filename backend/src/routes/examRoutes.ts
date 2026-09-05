import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";
import { sendExamCompletionAlert } from "../services/emailService";

const router = Router();

// POST /api/exam/submit - Submit candidate exam & evaluate server-side
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateEmail,
      companyId,
      answers = {},
      timeSpentSeconds = 0,
      tabSwitches = 0,
      proctoringStatus = "Verified",
      candidatePhoto,
      hasVideoRecording = false,
      videoFilename,
    } = req.body;

    if (!candidateName || !candidateEmail) {
      return res
        .status(400)
        .json({ error: "Candidate name and email are required." });
    }

    // 1. Fetch questions to evaluate score on the server
    const questions = await prisma.question.findMany({
      orderBy: { id: "asc" },
    });

    if (questions.length === 0) {
      return res.status(500).json({ error: "No exam questions found in database." });
    }

    let partAScore = 0;
    let partATotal = 0;
    let partBScore = 0;
    let partBTotal = 0;

    for (const q of questions) {
      if (q.section === "A") {
        partATotal++;
        if (answers[q.id] !== undefined && Number(answers[q.id]) === q.correctAnswer) {
          partAScore++;
        }
      } else {
        partBTotal++;
        if (answers[q.id] !== undefined && Number(answers[q.id]) === q.correctAnswer) {
          partBScore++;
        }
      }
    }

    const totalQuestions = questions.length;
    const score = partAScore + partBScore;
    const percentage = Number(((score / totalQuestions) * 100).toFixed(1));

    // 2. Fetch pass threshold from settings
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    const passThreshold = settings?.passingPercentage ?? 70;
    const isPassed = percentage >= passThreshold;

    // 3. Upsert candidate if not already present
    const trimmedEmail = candidateEmail.trim().toLowerCase();
    let candidate = await prisma.candidate.findUnique({
      where: { email: trimmedEmail },
    });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          name: candidateName.trim(),
          email: trimmedEmail,
          companyId: (companyId || "N/A").trim(),
          status: "Completed",
          totalAttempts: 1,
          highestScore: score,
          latestScore: score,
        },
      });
    } else {
      const highest = Math.max(candidate.highestScore ?? 0, score);
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          status: "Completed",
          totalAttempts: { increment: 1 },
          latestScore: score,
          highestScore: highest,
        },
      });
    }

    // 4. Save Attempt Record
    const attempt = await prisma.examAttempt.create({
      data: {
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        companyId: candidate.companyId,
        submittedAt: new Date(),
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
      },
    });

    // 5. Asynchronous Email Alert (non-blocking)
    sendExamCompletionAlert({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      companyId: candidate.companyId,
      score,
      totalQuestions,
      percentage,
      isPassed,
      timeSpentSeconds: Number(timeSpentSeconds),
      proctoringStatus,
      tabSwitches: Number(tabSwitches),
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
      },
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    return res.status(500).json({ error: "Failed to submit and evaluate exam." });
  }
});

// GET /api/exam/results - List results for Admin Dashboard
router.get("/results", async (req: Request, res: Response) => {
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
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Fetch exam results error:", error);
    return res.status(500).json({ error: "Failed to retrieve exam results." });
  }
});

// GET /api/exam/results/:id - Single attempt details
router.get("/results/:id", async (req: Request, res: Response) => {
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
    });
  } catch (error) {
    console.error("Fetch attempt error:", error);
    return res.status(500).json({ error: "Failed to fetch attempt details." });
  }
});

// GET /api/exam/results/export/csv - Export CSV file for Excel
router.get("/export/csv", async (_req: Request, res: Response) => {
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

