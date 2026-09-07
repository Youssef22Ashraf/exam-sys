import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { QUESTIONS } from "./defaultQuestions";
import { resolveAdminInitialPassword } from "./env";

/**
 * Fills an empty database on boot: admin accounts, exam settings, question
 * bank. Every step is guarded on a count, so a populated database is left
 * alone and a restart is a no-op.
 */
export async function bootstrapDatabase(): Promise<void> {
  try {
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      console.log("[Bootstrap] Creating initial administrator accounts...");
      // Never a literal. This used to be a committed password, identical on
      // every deployment, with no UI to change it. Production refuses to boot
      // without ADMIN_INITIAL_PASSWORD (see config/env.ts).
      const adminPassword = await bcrypt.hash(resolveAdminInitialPassword(), 10);
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
      console.log(
        "[Bootstrap] Admin users created: mofarreh.admin (SUPERADMIN) & admin (ADMIN). " +
          "Change the password in the admin portal before real candidates sit the exam."
      );
    }

    const settingsCount = await prisma.examSetting.count();
    if (settingsCount === 0) {
      console.log("[Bootstrap] Initializing default exam settings...");
      await prisma.examSetting.create({
        data: {
          id: "default-settings",
          examTitle: "Workplace Assessment System",
          durationMinutes: 30,
          passingPercentage: 70,
          sectorBadge: "Engineering & Construction Sector",
          allowReviewAnswers: true,
          notifyEmail: process.env.ADMIN_ALERT_EMAIL || null,
        },
      });
      console.log("[Bootstrap] Default exam settings initialized.");
    }

    const questionCount = await prisma.question.count();
    if (questionCount === 0) {
      await prisma.question.createMany({
        data: QUESTIONS.map((q) => ({
          id: q.id,
          section: q.section,
          sectionTitle: q.sectionTitle,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      });
      console.log(`[Bootstrap] Populated ${QUESTIONS.length} official questions.`);
    }
  } catch (error) {
    console.error("[Bootstrap Error] Could not complete database bootstrap:", error);
  }
}
