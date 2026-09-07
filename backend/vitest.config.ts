import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/globalSetup.ts"],
    // SQLite plus a single shared PrismaClient does not want parallel writers.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Set before any import, so config/db.ts builds its client against the
    // throwaway database and never the development one. dotenv does not
    // override an existing process.env value, so backend/.env cannot win.
    env: {
      DATABASE_URL: "file:./test.db",
      NODE_ENV: "test",
      JWT_SECRET: "test-only-secret-not-used-anywhere-else-0123456789",
      ADMIN_INITIAL_PASSWORD: "test-admin-password",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
