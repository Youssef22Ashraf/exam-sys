import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin, requireRole } from "../middleware/auth";
import { findActiveCooldown } from "../services/cooldown";
import { validateExamineeEmail } from "../services/validation";
import { validateCandidateIdentity } from "../services/candidateIdentity";

const router = Router();

// GET /api/candidates/check-cooldown - Check if candidate is within 48-hour cooldown & validate identity
router.get("/check-cooldown", async (req: Request, res: Response) => {
  try {
    const name = req.query.name ? String(req.query.name).trim() : "";
    const email = req.query.email ? String(req.query.email).trim().toLowerCase() : "";
    const companyId = req.query.companyId ? String(req.query.companyId).trim() : "";

    if (!email && !companyId) {
      return res.status(400).json({ error: "Email or Company ID is required." });
    }

    // 1. Strict Email Format Check
    if (email) {
      const emailCheck = validateExamineeEmail(email);
      if (!emailCheck.valid) {
        return res.status(400).json({
          eligible: false,
          error: "INVALID_EMAIL",
          message: emailCheck.message,
        });
      }
    }

    // 2. Identity Consistency Check (prevent mismatched ID/Name/Email)
    if (name && email && companyId) {
      const identityCheck = await validateCandidateIdentity(name, email, companyId);
      if (identityCheck.conflict) {
        return res.status(409).json({
          eligible: false,
          error: "IDENTITY_CONFLICT",
          message: identityCheck.publicMessage,
        });
      }
    }

    // 3. Cooldown Check
    const cooldown = await findActiveCooldown(email, companyId);
    if (cooldown) {
      return res.json({
        eligible: false,
        error: "COOLDOWN_ACTIVE",
        message: `You completed an assessment on ${new Date(cooldown.lastAttemptAt).toLocaleString()}. You are eligible to re-attempt after 48 hours.`,
        ...cooldown,
      });
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

    // 1. Strict Email Format Validation
    const emailCheck = validateExamineeEmail(trimmedEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({
        error: "INVALID_EMAIL",
        message: emailCheck.message,
      });
    }

    // 2. 1-to-1 Identity Consistency Validation
    const identityCheck = await validateCandidateIdentity(trimmedName, trimmedEmail, trimmedCompanyId);
    if (identityCheck.conflict) {
      return res.status(409).json({
        error: "IDENTITY_CONFLICT",
        message: identityCheck.publicMessage,
      });
    }

    // 3. Enforce 48-Hour Re-attempt Lockout
    const cooldown = await findActiveCooldown(trimmedEmail, trimmedCompanyId);
    if (cooldown) {
      return res.status(403).json({
        error: "COOLDOWN_ACTIVE",
        message: `You completed an assessment on ${new Date(cooldown.lastAttemptAt).toLocaleString()}. Re-attempts are permitted 48 hours after your previous submission.`,
        ...cooldown,
      });
    }

    // 4. Upsert candidate
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
router.get("/", authenticateAdmin, async (req: Request, res: Response) => {
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
router.get("/:id/history", authenticateAdmin, async (req: Request, res: Response) => {
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
router.delete("/:id", authenticateAdmin, requireRole("SUPERADMIN"), async (req: Request, res: Response) => {
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

    // Stamp the override; attempt timestamps are audit data and stay as they are.
    await prisma.candidate.update({
      where: { id },
      data: { cooldownClearedAt: new Date() },
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
