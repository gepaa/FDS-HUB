import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/**
 * Prisma 7 client with driver adapters.
 * - `file:` URLs → better-sqlite3 (local dev, zero setup)
 * - anything else → node-postgres (Neon / Vercel Postgres in prod)
 *
 * The Postgres switch also requires flipping `provider` in
 * prisma/schema.prisma — documented in README → "Database".
 */
function makeClient(): PrismaClient {
  const url = env.DATABASE_URL;
  const adapter = url.startsWith("file:")
    ? new PrismaBetterSqlite3({ url })
    : new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
