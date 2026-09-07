import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/index";
import { prisma } from "../src/config/db";

/**
 * Regression guards for the holes closed on the hardening branch. Each of
 * these was a live defect; a failure here means it is back.
 */

let adminToken = "";
let superToken = "";

beforeAll(async () => {
  await prisma.question.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.examSetting.deleteMany();

  await prisma.question.createMany({
    data: [
      { id: 1, section: "A", sectionTitle: "Part A", question: "Q1", options: JSON.stringify(["a", "b"]), correctAnswer: 0 },
      { id: 2, section: "A", sectionTitle: "Part A", question: "Q2", options: JSON.stringify(["a", "b"]), correctAnswer: 1 },
      { id: 3, section: "B", sectionTitle: "Part B", question: "Q3", options: JSON.stringify(["a", "b"]), correctAnswer: 0 },
      { id: 4, section: "B", sectionTitle: "Part B", question: "Q4", options: JSON.stringify(["a", "b"]), correctAnswer: 1 },
    ],
  });

  await prisma.examSetting.create({
    data: { id: "default-settings", durationMinutes: 30, passingPercentage: 70 },
  });

  const hash = await bcrypt.hash("test-admin-password", 10);
  await prisma.adminUser.create({ data: { username: "admin", passwordHash: hash, role: "ADMIN" } });
  await prisma.adminUser.create({ data: { username: "root", passwordHash: hash, role: "SUPERADMIN" } });

  adminToken = (
    await request(app).post("/api/admin/login").send({ username: "admin", password: "test-admin-password" })
  ).body.token;
  superToken = (
    await request(app).post("/api/admin/login").send({ username: "root", password: "test-admin-password" })
  ).body.token;
});

beforeEach(async () => {
  await prisma.examAttempt.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.examSession.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/questions", () => {
  it("withholds the answer key from an anonymous caller", async () => {
    const res = await request(app).get("/api/questions").expect(200);
    expect(res.body).toHaveLength(4);
    for (const q of res.body) {
      expect(q).not.toHaveProperty("correctAnswer");
      expect(q.options).toHaveLength(2);
    }
    // Belt and braces: the key must not appear anywhere in the payload.
    expect(JSON.stringify(res.body)).not.toContain("correctAnswer");
  });

  it("withholds it from a caller presenting a bad token", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(200);
    expect(res.body[0]).not.toHaveProperty("correctAnswer");
  });

  it("returns it to an admin", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body[0]).toHaveProperty("correctAnswer");
  });
});

describe("admin login", () => {
  it("refuses a wrong password", async () => {
    await request(app)
      .post("/api/admin/login")
      .send({ username: "admin", password: "wrong" })
      .expect(401);
  });

  it("refuses an unknown user with the same message", async () => {
    const a = await request(app).post("/api/admin/login").send({ username: "nobody", password: "x" });
    const b = await request(app).post("/api/admin/login").send({ username: "admin", password: "x" });
    expect(a.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });
});

describe("role enforcement", () => {
  it("refuses a question-bank reset to a plain ADMIN", async () => {
    await request(app)
      .post("/api/questions/reset")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
  });

  it("refuses a candidate delete to a plain ADMIN", async () => {
    await request(app)
      .delete("/api/candidates/whatever")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
  });

  it("lets a SUPERADMIN through to the handler", async () => {
    // 404 means the guard passed and the row simply does not exist.
    await request(app)
      .delete("/api/candidates/does-not-exist")
      .set("Authorization", `Bearer ${superToken}`)
      .expect(404);
  });
});

describe("uploads", () => {
  it("refuses an upload with no exam session", async () => {
    await request(app).post("/api/proctor/upload-video").expect(400);
  });

  it("refuses an upload for an unknown session", async () => {
    await request(app).post("/api/proctor/upload-video?sessionId=nope").expect(403);
  });

  it("does not serve uploads statically", async () => {
    // A public /uploads mount made candidate webcam stills world-readable.
    const res = await request(app).get("/uploads/videos/anything.webm");
    expect(res.status).not.toBe(200);
  });

  it("requires an admin token to read a snapshot", async () => {
    await request(app).get("/api/proctor/snapshot/whatever.jpg").expect(401);
  });
});

describe("POST /api/exam/submit", () => {
  const candidate = {
    candidateName: "Submit Tester",
    candidateEmail: "submit.tester@example.com",
    companyId: "ST-001",
  };

  async function openSession() {
    const res = await request(app)
      .post("/api/exam/start")
      .send({ candidateEmail: candidate.candidateEmail, companyId: candidate.companyId })
      .expect(201);
    return res.body.sessionId as string;
  }

  it("refuses a submit with no session", async () => {
    const res = await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, answers: { 1: 0 } })
      .expect(400);
    expect(res.body.error).toBe("SESSION_REQUIRED");
  });

  it("refuses an unknown session", async () => {
    const res = await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId: "not-a-session", answers: { 1: 0 } })
      .expect(400);
    expect(res.body.error).toBe("SESSION_UNKNOWN");
  });

  it("refuses a session belonging to someone else", async () => {
    const sessionId = await openSession();
    const res = await request(app)
      .post("/api/exam/submit")
      .send({
        candidateName: "Other Person",
        candidateEmail: "other.person@example.com",
        companyId: "OP-002",
        sessionId,
        answers: { 1: 0 },
      })
      .expect(403);
    expect(res.body.error).toBe("SESSION_MISMATCH");
  });

  it("scores on the server and ignores a client-supplied score", async () => {
    const sessionId = await openSession();
    const res = await request(app)
      .post("/api/exam/submit")
      .send({
        ...candidate,
        sessionId,
        answers: { 1: 0, 2: 1 }, // 2 of 4 correct
        score: 40,
        percentage: 100,
        isPassed: true,
        hasVideoRecording: true,
      })
      .expect(201);

    expect(res.body.result.score).toBe(2);
    expect(res.body.result.percentage).toBe(50);
    expect(res.body.result.isPassed).toBe(false);
  });

  it("derives the proctoring verdict rather than trusting the body", async () => {
    const sessionId = await openSession();
    const res = await request(app)
      .post("/api/exam/submit")
      .send({
        ...candidate,
        sessionId,
        answers: {},
        tabSwitches: 0,
        proctoringStatus: "Verified",
        hasVideoRecording: false,
      })
      .expect(201);

    // No recording can never read as Verified, whatever the client claims.
    expect(res.body.result.proctoringStatus).toBe("Camera Disabled");
  });

  it("times the exam from its own clock, not the body", async () => {
    const sessionId = await openSession();
    const res = await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId, answers: {}, timeSpentSeconds: 99999, hasVideoRecording: true })
      .expect(201);

    expect(res.body.result.timeSpentSeconds).toBeLessThan(60);
  });

  it("refuses to replay a spent session", async () => {
    const sessionId = await openSession();
    await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId, answers: {}, hasVideoRecording: true })
      .expect(201);

    // Clear the lockout so the session guard is what answers, not the cooldown.
    const row = await prisma.candidate.findUnique({ where: { email: candidate.candidateEmail } });
    await prisma.candidate.update({
      where: { id: row!.id },
      data: { cooldownClearedAt: new Date() },
    });

    const res = await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId, answers: {}, hasVideoRecording: true })
      .expect(409);
    expect(res.body.error).toBe("SESSION_ALREADY_SUBMITTED");
  });

  it("enforces the 48-hour lockout", async () => {
    const first = await openSession();
    await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId: first, answers: {}, hasVideoRecording: true })
      .expect(201);

    const second = await openSession();
    const res = await request(app)
      .post("/api/exam/submit")
      .send({ ...candidate, sessionId: second, answers: {}, hasVideoRecording: true })
      .expect(403);
    expect(res.body.error).toBe("COOLDOWN_ACTIVE");
  });
});

describe("candidate PII", () => {
  it("does not name the matching record in a public conflict message", async () => {
    await prisma.candidate.create({
      data: { name: "Real Person", email: "real.person@example.com", companyId: "RP-001" },
    });

    const res = await request(app)
      .get("/api/candidates/check-cooldown")
      .query({ name: "Guessing Attacker", email: "attacker@example.com", companyId: "RP-001" })
      .expect(409);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("Real Person");
    expect(body).not.toContain("real.person@example.com");
  });

  it("requires a token to list candidates", async () => {
    await request(app).get("/api/candidates").expect(401);
  });

  it("requires a token to export the CSV", async () => {
    await request(app).get("/api/exam/export/csv").expect(401);
  });
});

describe("CSV export", () => {
  it("neutralises a formula-leading candidate name", async () => {
    const sessionId = (
      await request(app)
        .post("/api/exam/start")
        .send({ candidateEmail: "csv.tester@example.com", companyId: "CSV-1" })
    ).body.sessionId;

    await request(app)
      .post("/api/exam/submit")
      .send({
        candidateName: '=HYPERLINK("http://evil","click")',
        candidateEmail: "csv.tester@example.com",
        companyId: "CSV-1",
        sessionId,
        answers: {},
        hasVideoRecording: true,
      })
      .expect(201);

    const res = await request(app)
      .get("/api/exam/export/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.text).toContain(`"'=HYPERLINK`);
  });
});
