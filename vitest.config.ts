import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Test setup.
 *
 * Integration tests run against a REAL SQLite database (tests/test.db,
 * rebuilt from the migrations before each run) rather than a mocked
 * Prisma client. The behaviour being tested here — unique constraints
 * stopping duplicate calls, upserts tolerating out-of-order events — is
 * database behaviour, and a mock would happily pass while production
 * broke.
 *
 * External Quo HTTP calls are always mocked. The suite never needs a
 * real API key, a network connection, or a real telephone call.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one SQLite file; run them in one process
    // so they cannot deadlock each other on writes.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
