import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// GET /api/candidates/check-cooldown - Check if candidate is within 48-hour cooldown
router.get("/check-cooldown", async (req: Request, res: Response) => {
  try {
    const email = req.query.email ? String(req.query.email).trim().toLowerCase() : "";
    const companyId = req.query.companyId ? String(req.query.companyId).trim() : "";

    if (!email && !companyId) {
      return res.status(400).json({ error: "Email or Company ID is required." });
    }

    const whereConditions: any[] = [];
    if (email) whereConditions.push({ candidateEmail: email });
    if (companyId) whereConditions.push({ companyId: companyId });

    const lastAttempt = await prisma.examAttempt.findFirst({
      where: { OR: whereConditions },
      orderBy: { submittedAt: "desc" },
    });

    if (lastAttempt) {
      const now = new Date();
      const elapsedMs = now.getTime() - new Date(lastAttempt.submittedAt).getTime();
      const cooldownMs = 48 * 60 * 60 * 1000; // 48 hours

      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const availableAt = new Date(new Date(lastAttempt.submittedAt).getTime() + cooldownMs);

        return res.json({
          eligible: false,
          error: "COOLDOWN_ACTIVE",
          message: `You completed an assessment on ${new Date(lastAttempt.submittedAt).toLocaleString()}. You are eligible to re-attempt after 48 hours.`,
          lastAttemptAt: lastAttempt.submittedAt.toISOString(),
          nextAttemptAvailableAt: availableAt.toISOString(),
          remainingHours,
          attemptNumber: (lastAttempt.attemptNumber || 1) + 1,
        });
      }
    }

    return res.json({ eligible: true });
  } catch (error) {
    console.error("Check cooldown error:", error);
    return res.status(500).json({ error: "Failed to check candidate eligibility." });
  }
});

// POST /api/candidates/register - Public (examinee registration)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, companyId } = req.body;

    if (!name || !email || !companyId) {
      return res
        .status(400)
        .json({ error: "Name, email, and company ID are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedCompanyId = companyId.trim();

    // 1. Enforce 48-Hour Re-attempt Lockout
    const lastAttempt = await prisma.examAttempt.findFirst({
      where: {
        OR: [
          { candidateEmail: trimmedEmail },
          { companyId: trimmedCompanyId },
        ],
      },
      orderBy: { submittedAt: "desc" },
    });

    if (lastAttempt) {
      const now = new Date();
      const elapsedMs = now.getTime() - new Date(lastAttempt.submittedAt).getTime();
      const cooldownMs = 48 * 60 * 60 * 1000;

      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const availableAt = new Date(new Date(lastAttempt.submittedAt).getTime() + cooldownMs);

        return res.status(403).json({
          error: "COOLDOWN_ACTIVE",
          message: `You completed an assessment on ${new Date(lastAttempt.submittedAt).toLocaleString()}. Re-attempts are permitted 48 hours after your previous submission.`,
          lastAttemptAt: lastAttempt.submittedAt.toISOString(),
          nextAttemptAvailableAt: availableAt.toISOString(),
          remainingHours,
          attemptNumber: (lastAttempt.attemptNumber || 1) + 1,
        });
      }
    }

    // 2. Upsert candidate so existing candidates can take another exam
    let candidate = await prisma.candidate.findUnique({
      where: { email: trimmedEmail },
    });

    if (candidate) {
      candidate = await prisma.candidate.update({
        where: { email: trimmedEmail },
        data: {
          name: trimmedName,
          companyId: trimmedCompanyId,
          status: "In Progress",
        },
      });
    } else {
      candidate = await prisma.candidate.create({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          companyId: trimmedCompanyId,
          status: "In Progress",
        },
      });
    }

    return res.status(200).json({ success: true, candidate });
  } catch (error) {
    console.error("Candidate registration error:", error);
    return res
      .status(500)
      .json({ error: "Failed to register or update candidate." });
  }
});

// GET /api/candidates - Admin candidate directory
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;

    const where: any = {};
    if (status && typeof status === "string" && status !== "ALL") {
      where.status = status;
    }

    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { companyId: { contains: search } },
      ];
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      include: {
        _count: {
          select: { attempts: true },
        },
      },
    });

    // Map to include totalAttempts
    const formatted = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      companyId: c.companyId,
      registeredAt: c.registeredAt.toISOString(),
      status: c.status,
      totalAttempts: c.totalAttempts || c._count.attempts,
      highestScore: c.highestScore,
      latestScore: c.latestScore,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Fetch candidates error:", error);
    return res.status(500).json({ error: "Failed to retrieve candidates." });
  }
});

// GET /api/candidates/:id/history - Retrieve all attempts of a candidate
router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        attempts: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }

    const formattedAttempts = candidate.attempts.map((att) => ({
      ...att,
      submittedAt: att.submittedAt.toISOString(),
      answers: JSON.parse(att.answers || "{}"),
    }));

    return res.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        companyId: candidate.companyId,
        registeredAt: candidate.registeredAt.toISOString(),
        status: candidate.status,
      },
      attempts: formattedAttempts,
    });
  } catch (error) {
    console.error("Fetch candidate history error:", error);
    return res.status(500).json({ error: "Failed to fetch candidate history." });
  }
});

// DELETE /api/candidates/:id - Delete candidate
router.delete("/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.candidate.delete({
      where: { id },
    });
    return res.json({ success: true, message: "Candidate deleted successfully." });
  } catch (error) {
    console.error("Delete candidate error:", error);
    return res.status(500).json({ error: "Failed to delete candidate." });
  }
});

// POST /api/candidates/:id/clear-cooldown - Admin manual override to clear 48-hour lockout
router.post("/:id/clear-cooldown", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }

    // Shift last attempts back by 49 hours so cooldown is immediately lifted
    const pastDate = new Date(Date.now() - 49 * 60 * 60 * 1000);
    await prisma.candidate.update({
      where: { id },
      data: { lastAttemptAt: pastDate },
    });

    await prisma.examAttempt.updateMany({
      where: {
        OR: [
          { candidateId: candidate.id },
          { candidateEmail: candidate.email },
          { companyId: candidate.companyId },
        ],
      },
      data: { submittedAt: pastDate },
    });

    return res.json({
      success: true,
      message: "Candidate cooldown successfully cleared. Early re-attempt is now permitted.",
    });
  } catch (error) {
    console.error("Clear cooldown error:", error);
    return res.status(500).json({ error: "Failed to reset candidate cooldown." });
  }
});

export default router;

