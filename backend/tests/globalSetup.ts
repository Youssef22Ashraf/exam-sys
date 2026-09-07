import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Build a throwaway SQLite database for the suite.
 *
 * Deliberately a separate file from prisma/dev.db: the tests insert and delete
 * candidates and attempts, and must never touch a developer's data.
 */
const TEST_DB = path.resolve(__dirname, "../prisma/test.db");

function clean() {
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

export async function setup() {
  clean();
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}

export async function teardown() {
  clean();
}
