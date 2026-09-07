import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";
import { findActiveCooldown } from "../services/cooldown";

const router = Router();

// Strict Examinee Email Validation Helper
export function validateExamineeEmail(email: string): { valid: boolean; message?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email address is required." };
  }
  const trimmed = email.trim().toLowerCase();

  // Basic RFC format test (local@domain.tld)
  const generalEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!generalEmailRegex.test(trimmed)) {
    return {
      valid: false,
      message: "Please enter a valid email address (e.g. employee@gmail.com, candidate@outlook.com, or company email).",
    };
  }

  // Domain structure checks
  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, message: "Malformed email address." };
  }
  const domain = parts[1];
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false, message: "Email domain is invalid." };
  }

  return { valid: true };
}

// 1-to-1 Candidate Identity Consistency Checker
export async function validateCandidateIdentity(name: string, email: string, companyId: string) {
  const normName = name.trim().toLowerCase();
  const normEmail = email.trim().toLowerCase();
  const normCompanyId = companyId.trim().toLowerCase();

  // Query all candidates to check for 1-to-1 uniqueness and cross-consistency
  const allCandidates = await prisma.candidate.findMany();

  for (const cand of allCandidates) {
    const cName = cand.name.trim().toLowerCase();
    const cEmail = cand.email.trim().toLowerCase();
    const cCompanyId = cand.companyId.trim().toLowerCase();

    // Check Company ID collisions
    if (cCompanyId === normCompanyId) {
      if (cName !== normName) {
        return {
          conflict: true,
          message: `Company ID '${companyId.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`,
        };
      }
      if (cEmail !== normEmail) {
        return {
          conflict: true,
          message: `Company ID '${companyId.trim()}' is already registered with email '${cand.email}'. The entered email does not match.`,
        };
      }
    }

    // Check Name collisions
    if (cName === normName) {
      if (cCompanyId !== normCompanyId) {
        return {
          conflict: true,
          message: `Candidate '${name.trim()}' is already registered under Company ID '${cand.companyId}'. Please use your registered Company ID.`,
        };
      }
      if (cEmail !== normEmail) {
        return {
          conflict: true,
          message: `Candidate '${name.trim()}' is already registered with email '${cand.email}'. Please use your registered email address.`,
        };
      }
    }

    // Check Email collisions
    if (cEmail === normEmail) {
      if (cCompanyId !== normCompanyId) {
        return {
          conflict: true,
          message: `Email '${email.trim()}' is already registered under Company ID '${cand.companyId}'. The entered Company ID does not match.`,
        };
      }
      if (cName !== normName) {
        return {
          conflict: true,
          message: `Email '${email.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`,
        };
      }
    }
  }

  // Also check prior exam attempts to catch any attempts submitted before
  const allAttempts = await prisma.examAttempt.findMany({
    select: { candidateName: true, candidateEmail: true, companyId: true },
  });

  for (const att of allAttempts) {
    const aName = att.candidateName.trim().toLowerCase();
    const aEmail = att.candidateEmail.trim().toLowerCase();
    const aCompanyId = att.companyId.trim().toLowerCase();

    if (aCompanyId === normCompanyId && aName !== normName) {
      return {
        conflict: true,
        message: `Company ID '${companyId.trim()}' has a previous exam record under candidate '${att.candidateName}'.`,
      };
    }
    if (aCompanyId === normCompanyId && aEmail !== normEmail) {
      return {
        conflict: true,
        message: `Company ID '${companyId.trim()}' has a previous exam record with email '${att.candidateEmail}'.`,
      };
    }
    if (aName === normName && aCompanyId !== normCompanyId) {
      return {
        conflict: true,
        message: `Candidate '${name.trim()}' has a previous exam record under Company ID '${att.companyId}'.`,
      };
    }
    if (aEmail === normEmail && aCompanyId !== normCompanyId) {
      return {
        conflict: true,
        message: `Email '${email.trim()}' has a previous exam record under Company ID '${att.companyId}'.`,
      };
    }
  }

  return { conflict: false };
}

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
          message: identityCheck.message,
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
        message: identityCheck.message,
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
