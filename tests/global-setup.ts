import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Build a fresh test database from the committed migrations.
 *
 * Using the real migrations (rather than `db push`) means the suite
 * also proves the migrations themselves apply cleanly — including the
 * hand-rewritten additive one for the Supplier table.
 */
export default function setup() {
  const dbPath = path.resolve(__dirname, "test.db");
  const url = `file:${dbPath}`;

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  // Prisma 7's SQLite schema engine no longer creates the database file
  // itself in every environment. An empty file is a valid SQLite target.
  fs.writeFileSync(dbPath, "");

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return () => {
    // Left in place after the run so a failing test can be inspected.
  };
}
