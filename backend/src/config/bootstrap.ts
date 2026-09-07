import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { QUESTIONS } from "./defaultQuestions";

export async function bootstrapDatabase(): Promise<void> {
  try {
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      console.log("‡üå± [Bootstrap] Creating initial administrator accounts...");
      const adminPassword = await bcrypt.hash("Mofarreh@2026", 10);
      await prisma.adminUser.create({
        data: {
          username: "mofarreh.admin",
          passwordHash: adminPassword,
          role: "SUPERADMIN",
        },
      });
      await prisma.adminUser.create({
        data: {
          username: "admin",
          passwordHash: adminPassword,
          role: "ADMIN",
        },
      });
      console.log("üë¶ [Bootstrap] Admin users created: mofarreh.admin & admin");
    }

    const settingsCount = await prisma.examSetting.count();
    if (settingsCount === 0) {
      console.log("‡üå± [Bootstrap] Initializing default exam settings...");
      await prisma.examSetting.create({
        data: {
          id: "default-settings",
          examTitle: "Workplace Assessment System",
          durationMinutes: 30,
          passingPercentage: 70,
          sectorBadge: "Engineering & Construction Sector",
          allowReviewAnswers: true,
          notifyEmail: "admin@harbico.com",
        },
      });
      console.log("‚ö°Ô∏è  [Bootstrap] Default exam settings initialized.");
    }

    const questionCount = await prisma.question.count();
    if (questionCount === 0) {
      const batch = QUESTIONS.map((q) => ({
        id: q.id,
        section: q.section,
        sectionTitle: q.sectionTitle,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      }));
      for (const q of batch) {
        await prisma.question.create({ data: q });
      }
      console.log(`d~s [Bootstrap] Populated ${QUESTIONS.length} official questions.`);
    }
  } catch (error) {
    console.error("‚ö†Ô∏è [Bootstrap Error] Could not complete database bootstrap:", error);
  }
}
