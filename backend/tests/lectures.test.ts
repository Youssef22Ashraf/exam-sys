import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/index";
import { prisma } from "../src/config/db";

let adminToken = "";

beforeAll(async () => {
  await prisma.adminUser.deleteMany();
  const hash = await bcrypt.hash("admin-secret-pass", 10);
  await prisma.adminUser.create({
    data: { username: "lecture-admin", passwordHash: hash, role: "ADMIN" },
  });

  const res = await request(app)
    .post("/api/admin/login")
    .send({ username: "lecture-admin", password: "admin-secret-pass" });
  adminToken = res.body.token;
});

beforeEach(async () => {
  await prisma.lectureAttendance.deleteMany();
  await prisma.candidate.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Lectures & Recordings System", () => {
  it("GET /api/lectures returns the 4 briefings with valid metadata", async () => {
    const res = await request(app).get("/api/lectures").expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(4);

    const ids = res.body.map((l: any) => l.id);
    expect(ids).toContain("interface-management");
    expect(ids).toContain("stakeholder-management");
    expect(ids).toContain("interface-vs-stakeholder");
    expect(ids).toContain("logistics-management");

    for (const lec of res.body) {
      expect(lec).toHaveProperty("title");
      expect(lec).toHaveProperty("subtitle");
      expect(lec).toHaveProperty("durationSeconds");
      expect(lec).toHaveProperty("slideCount");
      expect(lec).toHaveProperty("hasVideo");
      expect(lec).toHaveProperty("hasSlides");
    }
  });

  it("GET /api/lectures/:id returns details with outline", async () => {
    const res = await request(app)
      .get("/api/lectures/interface-management")
      .expect(200);
    expect(res.body.id).toBe("interface-management");
    expect(res.body.title).toBe("Interface Management Procedure Briefing");
    expect(res.body.outline).toBeInstanceOf(Array);
    expect(res.body.outline.length).toBeGreaterThan(0);
  });

  it("GET /api/lectures/:id returns 404 for unknown lecture", async () => {
    await request(app).get("/api/lectures/invalid-id").expect(404);
  });

  it("POST /api/lectures/access requires name, email, companyId, and department", async () => {
    const missingDept = await request(app)
      .post("/api/lectures/access")
      .send({
        name: "Ahmed Hassan",
        email: "ahmed@mofarreh.com",
        companyId: "EMP-1001",
      })
      .expect(400);
    expect(missingDept.body.error).toContain("Department is required");

    const invalidEmail = await request(app)
      .post("/api/lectures/access")
      .send({
        name: "Ahmed Hassan",
        email: "not-an-email",
        companyId: "EMP-1001",
        department: "Engineering",
      })
      .expect(400);
    expect(invalidEmail.body.error).toBeDefined();

    const valid = await request(app)
      .post("/api/lectures/access")
      .send({
        name: "Ahmed Hassan",
        email: "ahmed@mofarreh.com",
        companyId: "EMP-1001",
        department: "Interface Management",
        lectureId: "interface-management",
      })
      .expect(201);

    expect(valid.body.success).toBe(true);
    expect(valid.body.attendanceId).toBeDefined();
    expect(valid.body.record.candidateName).toBe("Ahmed Hassan");
    expect(valid.body.record.department).toBe("Interface Management");

    // Also verifies Candidate was synced with department
    const candidate = await prisma.candidate.findUnique({
      where: { email: "ahmed@mofarreh.com" },
    });
    expect(candidate).toBeDefined();
    expect(candidate?.department).toBe("Interface Management");
  });

  it("POST /api/lectures/track updates watch progress and duration", async () => {
    const accessRes = await request(app)
      .post("/api/lectures/access")
      .send({
        name: "Sara Adel",
        email: "sara.adel@mofarreh.com",
        companyId: "EMP-2002",
        department: "Project Controls",
        lectureId: "stakeholder-management",
      })
      .expect(201);

    const attendanceId = accessRes.body.attendanceId;

    const trackRes = await request(app)
      .post("/api/lectures/track")
      .send({
        attendanceId,
        name: "Sara Adel",
        email: "sara.adel@mofarreh.com",
        companyId: "EMP-2002",
        department: "Project Controls",
        lectureId: "stakeholder-management",
        action: "VIDEO_WATCHED",
        watchDurationSeconds: 120,
        maxProgressPercent: 25.5,
      })
      .expect(200);

    expect(trackRes.body.success).toBe(true);
    expect(trackRes.body.record.watchDurationSeconds).toBe(120);
    expect(trackRes.body.record.maxProgressPercent).toBeCloseTo(25.5);
  });

  it("GET /api/lectures/:id/subtitles serves WebVTT captions", async () => {
    const res = await request(app)
      .get("/api/lectures/interface-management/subtitles")
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/vtt");
    expect(res.text).toContain("WEBVTT");
    expect(res.text).toContain("-->");
  });

  it("GET /api/lectures/admin/attendance enforces authentication", async () => {
    await request(app).get("/api/lectures/admin/attendance").expect(401);

    // Create 2 attendance entries
    await request(app).post("/api/lectures/access").send({
      name: "Eng. Omar",
      email: "omar@mofarreh.com",
      companyId: "EMP-3001",
      department: "Engineering",
      lectureId: "interface-management",
    });
    await request(app).post("/api/lectures/access").send({
      name: "Eng. Layla",
      email: "layla@mofarreh.com",
      companyId: "EMP-3002",
      department: "Construction",
      lectureId: "logistics-management",
    });

    const res = await request(app)
      .get("/api/lectures/admin/attendance")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.attendance).toHaveLength(2);
    expect(res.body.stats.totalAttendees).toBe(2);
    expect(res.body.stats.departments.length).toBe(2);
  });

  it("GET /api/lectures/admin/export returns CSV with UTF-8 BOM", async () => {
    await request(app).post("/api/lectures/access").send({
      name: "Tarek Mostafa",
      email: "tarek@mofarreh.com",
      companyId: "EMP-4001",
      department: "HSE / Safety",
      lectureId: "interface-vs-stakeholder",
    });

    const res = await request(app)
      .get("/api/lectures/admin/export")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain(".csv");
    // UTF-8 BOM is \uFEFF
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain("Tarek Mostafa");
    expect(res.text).toContain("HSE / Safety");
    expect(res.text).toContain("Department (From Where)");
    expect(res.text).toContain("Checklist Completion (%)");
    expect(res.text).toContain("Video Watched");
    expect(res.text).toContain("Slides Reviewed");
  });

  it("POST /api/lectures/checklist updates checklist items and returns computed percentage", async () => {
    const res = await request(app)
      .post("/api/lectures/checklist")
      .send({
        name: "Youssef Nabil",
        email: "youssef.nabil@mofarreh.com",
        companyId: "EMP-5001",
        department: "Interface Management",
        lectureId: "interface-management",
        completedItems: ["video", "slides", "ip_identification"],
        action: "CHECKLIST_UPDATED",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    // Video (35) + Slides (35) + 1/5 checkpoints (4) = 74%
    expect(res.body.completionPercent).toBeGreaterThanOrEqual(70);
    expect(res.body.progress.videoCompleted).toBe(true);
    expect(res.body.progress.slidesViewed).toBe(true);
    expect(res.body.progress.completedItems).toContain("ip_identification");

    // Verify user can retrieve their saved progress
    const getProg = await request(app)
      .get("/api/lectures/user/progress?email=youssef.nabil@mofarreh.com")
      .expect(200);

    expect(getProg.body.progress).toHaveLength(1);
    expect(getProg.body.progress[0].lectureId).toBe("interface-management");
    expect(getProg.body.progress[0].completionPercent).toBe(res.body.completionPercent);
  });

  it("GET /api/lectures/:id returns complete slide items and checkpoints", async () => {
    const res = await request(app)
      .get("/api/lectures/interface-management")
      .expect(200);

    expect(res.body.slides).toBeInstanceOf(Array);
    expect(res.body.slides.length).toBe(28);
    expect(res.body.slides[0]).toHaveProperty("slideNumber", 1);
    expect(res.body.slides[0]).toHaveProperty("title");
    expect(res.body.slides[0]).toHaveProperty("content");

    expect(res.body.checkpoints).toBeInstanceOf(Array);
    expect(res.body.checkpoints.length).toBeGreaterThan(0);
    expect(res.body.checkpoints[0]).toHaveProperty("id");
    expect(res.body.checkpoints[0]).toHaveProperty("label");
  });
});
