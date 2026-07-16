import "dotenv/config";
import { defineConfig } from "prisma/config";

// Falls back to the local SQLite dev database so a fresh clone works
// with zero setup. Set DATABASE_URL (e.g. a Neon/Vercel Postgres URL)
// to point at a real database — see README → "Database".
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
