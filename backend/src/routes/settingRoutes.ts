import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { authenticateAdmin } from "../middleware/auth";
import { sendTestEmailAlert } from "../services/emailService";

const router = Router();

// GET /api/settings - Fetch current exam settings
router.get("/", async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });

    if (!settings) {
      settings = await prisma.examSetting.create({
        data: {
          id: "default-settings",
          examTitle: "Workplace Assessment System",
          durationMinutes: 30,
          passingPercentage: 70,
          sectorBadge: "Engineering & Construction Sector",
          allowReviewAnswers: true,
        },
      });
    }

    return res.json({
      examTitle: settings.examTitle,
      durationMinutes: settings.durationMinutes,
      passingPercentage: settings.passingPercentage,
      sectorBadge: settings.sectorBadge,
      allowReviewAnswers: settings.allowReviewAnswers,
      notifyEmail: settings.notifyEmail,
    });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return res.status(500).json({ error: "Failed to retrieve settings." });
  }
});

// PUT /api/settings - Update settings (Admin)
router.put("/", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const {
      examTitle,
      durationMinutes,
      passingPercentage,
      sectorBadge,
      allowReviewAnswers,
      notifyEmail,
    } = req.body;

    const updated = await prisma.examSetting.upsert({
      where: { id: "default-settings" },
      update: {
        ...(examTitle && { examTitle: examTitle.trim() }),
        ...(durationMinutes !== undefined && {
          durationMinutes: Number(durationMinutes),
        }),
        ...(passingPercentage !== undefined && {
          passingPercentage: Number(passingPercentage),
        }),
        ...(sectorBadge && { sectorBadge: sectorBadge.trim() }),
        ...(allowReviewAnswers !== undefined && {
          allowReviewAnswers: Boolean(allowReviewAnswers),
        }),
        ...(notifyEmail !== undefined && { notifyEmail }),
      },
      create: {
        id: "default-settings",
        examTitle: examTitle || "Workplace Assessment System",
        durationMinutes: Number(durationMinutes) || 30,
        passingPercentage: Number(passingPercentage) || 70,
        sectorBadge: sectorBadge || "Engineering & Construction Sector",
        allowReviewAnswers: allowReviewAnswers ?? true,
        notifyEmail,
      },
    });

    return res.json({
      success: true,
      settings: {
        examTitle: updated.examTitle,
        durationMinutes: updated.durationMinutes,
        passingPercentage: updated.passingPercentage,
        sectorBadge: updated.sectorBadge,
        allowReviewAnswers: updated.allowReviewAnswers,
        notifyEmail: updated.notifyEmail,
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ error: "Failed to update settings." });
  }
});

// POST /api/settings/test-email - Trigger a test email alert
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await sendTestEmailAlert(email);
    return res.json(result);
  } catch (error: any) {
    console.error("Test email trigger error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to trigger test email.",
    });
  }
});

export default router;

