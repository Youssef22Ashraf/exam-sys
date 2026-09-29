import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { QUESTIONS } from "./defaultQuestions";
import { resolveAdminInitialPassword } from "./env";

/**
 * Ensures LectureAttendance and LectureProgress tables exist in SQLite dev.db
 * even if the mounted volume shadowed schema.prisma on container boot.
 */
export async function ensureLectureTablesExist(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LectureAttendance" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "candidateName" TEXT NOT NULL,
        "candidateEmail" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "lectureId" TEXT NOT NULL,
        "lectureTitle" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "watchDurationSeconds" INTEGER NOT NULL DEFAULT 0,
        "maxProgressPercent" INTEGER NOT NULL DEFAULT 0,
        "completedItems" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureAttendance_candidateEmail_idx" ON "LectureAttendance"("candidateEmail");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureAttendance_companyId_idx" ON "LectureAttendance"("companyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureAttendance_department_idx" ON "LectureAttendance"("department");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureAttendance_lectureId_idx" ON "LectureAttendance"("lectureId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureAttendance_createdAt_idx" ON "LectureAttendance"("createdAt");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LectureProgress" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "candidateEmail" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "lectureId" TEXT NOT NULL,
        "videoCompleted" BOOLEAN NOT NULL DEFAULT 0,
        "slidesViewed" BOOLEAN NOT NULL DEFAULT 0,
        "checkpointsFinished" BOOLEAN NOT NULL DEFAULT 0,
        "slidesDownloaded" BOOLEAN NOT NULL DEFAULT 0,
        "completionPercent" INTEGER NOT NULL DEFAULT 0,
        "completedItems" TEXT NOT NULL DEFAULT '[]',
        "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "LectureProgress_candidateEmail_lectureId_key" ON "LectureProgress"("candidateEmail", "lectureId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureProgress_candidateEmail_idx" ON "LectureProgress"("candidateEmail");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureProgress_companyId_idx" ON "LectureProgress"("companyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureProgress_department_idx" ON "LectureProgress"("department");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LectureProgress_lectureId_idx" ON "LectureProgress"("lectureId");
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Candidate" ADD COLUMN "department" TEXT;`);
    } catch {
      // Column already exists
    }
  } catch (err) {
    console.error("[Bootstrap] Error ensuring lecture tables exist:", err);
  }
}

/**
 * Fills an empty database on boot: admin accounts, exam settings, question
 * bank. Every step is guarded on a count, so a populated database is left
 * alone and a restart is a no-op.
 */
export async function bootstrapDatabase(): Promise<void> {
  try {
    // First, self-heal lecture tables in case a mounted volume shadowed the schema
    await ensureLectureTablesExist();

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
