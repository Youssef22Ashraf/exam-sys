import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

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

    // Upsert candidate so existing candidates can take another exam
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

export default router;

