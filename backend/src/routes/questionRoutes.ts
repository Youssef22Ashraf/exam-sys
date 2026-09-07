import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin, optionalAdmin, requireRole, AuthRequest } from "../middleware/auth";
import { QUESTIONS } from "../config/defaultQuestions";

const router = Router();

// GET /api/questions - List all questions
//
// ADR 001 says the server owns pass/fail, but that is worth nothing while the
// answer key is one unauthenticated GET away. `correctAnswer` is returned only
// to a caller holding an admin JWT; the exam page never needs it.
router.get("/", optionalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { id: "asc" },
    });

    const isAdmin = Boolean(req.user);
    const formatted = questions.map((q) => ({
      id: q.id,
      section: q.section,
      sectionTitle: q.sectionTitle,
      question: q.question,
      options: JSON.parse(q.options),
      ...(isAdmin ? { correctAnswer: q.correctAnswer } : {}),
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Fetch questions error:", error);
    return res.status(500).json({ error: "Failed to retrieve questions." });
  }
});

// POST /api/questions - Create new question (Admin)
router.post("/", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { section, sectionTitle, question, options, correctAnswer } = req.body;

    if (!section || !question || !Array.isArray(options) || correctAnswer === undefined) {
      return res.status(400).json({ error: "Invalid question data provided." });
    }

    // max(id)+1 and the insert in one transaction, or two concurrent adds
    // pick the same id and the second one fails on the primary key.
    const created = await prisma.$transaction(async (tx) => {
      const maxIdQuestion = await tx.question.findFirst({
        orderBy: { id: "desc" },
      });
      const nextId = (maxIdQuestion?.id || 0) + 1;
      return tx.question.create({
      data: {
        id: nextId,
        section,
        sectionTitle:
          sectionTitle ||
          (section === "A"
            ? "Part A — Interface Management"
            : "Part B — Stakeholder Management"),
        question: question.trim(),
        options: JSON.stringify(options),
        correctAnswer: Number(correctAnswer),
      },
      });
    });

    return res.status(201).json({
      id: created.id,
      section: created.section,
      sectionTitle: created.sectionTitle,
      question: created.question,
      options: JSON.parse(created.options),
      correctAnswer: created.correctAnswer,
    });
  } catch (error) {
    console.error("Create question error:", error);
    return res.status(500).json({ error: "Failed to create question." });
  }
});

// PUT /api/questions/:id - Update question (Admin)
router.put("/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { section, sectionTitle, question, options, correctAnswer } = req.body;

    const updated = await prisma.question.update({
      where: { id },
      data: {
        ...(section && { section }),
        ...(sectionTitle && { sectionTitle }),
        ...(question && { question: question.trim() }),
        ...(options && { options: JSON.stringify(options) }),
        ...(correctAnswer !== undefined && { correctAnswer: Number(correctAnswer) }),
      },
    });

    return res.json({
      id: updated.id,
      section: updated.section,
      sectionTitle: updated.sectionTitle,
      question: updated.question,
      options: JSON.parse(updated.options),
      correctAnswer: updated.correctAnswer,
    });
  } catch (error) {
    console.error("Update question error:", error);
    return res.status(500).json({ error: "Failed to update question." });
  }
});

// DELETE /api/questions/:id - Delete question (Admin)
router.delete("/:id", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.question.delete({
      where: { id },
    });
    return res.json({ success: true, message: `Question #${id} deleted.` });
  } catch (error) {
    console.error("Delete question error:", error);
    return res.status(500).json({ error: "Failed to delete question." });
  }
});

// POST /api/questions/reset - Restore default 40 questions (Admin)
router.post("/reset", authenticateAdmin, requireRole("SUPERADMIN"), async (_req: Request, res: Response) => {
  try {
    await prisma.question.deleteMany();
    for (const q of QUESTIONS) {
      await prisma.question.create({
        data: {
          id: q.id,
          section: q.section,
          sectionTitle: q.sectionTitle,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
        },
      });
    }
    const questions = await prisma.question.findMany({
      orderBy: { id: "asc" },
    });
    const formatted = questions.map((q) => ({
      id: q.id,
      section: q.section,
      sectionTitle: q.sectionTitle,
      question: q.question,
      options: JSON.parse(q.options),
      correctAnswer: q.correctAnswer,
    }));
    return res.json(formatted);
  } catch (error) {
    console.error("Reset questions error:", error);
    return res.status(500).json({ error: "Failed to reset questions to default." });
  }
});

export default router;

