import "dotenv/config";
import { defineConfig } from "prisma/config";

// Dual-database setup (docs/FDS_HQ_Decisions.md):
// - file: URL (default)  → SQLite — local dev, zero setup
// - anything else        → PostgreSQL — production (Neon / Vercel Postgres)
// The two schemas differ ONLY in provider + output path; keep the models
// identical. The runtime driver adapter switches the same way in
// src/lib/prisma.ts.
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isSqlite = url.startsWith("file:");

export default defineConfig({
  schema: isSqlite ? "prisma/schema.prisma" : "prisma/postgres/schema.prisma",
  migrations: {
    path: isSqlite ? "prisma/migrations" : "prisma/postgres/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
