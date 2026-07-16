/**
 * One-time data migration: map legacy pipeline stages to the spec's
 * supplier ladder (docs/FDS_HQ_Decisions.md D3) and assign human
 * record IDs (FDS-SUP-####).
 *
 *   NOT_CONTACTED + rank        → QUALIFIED   (already vetted in the sheet)
 *   NOT_CONTACTED + no rank     → SOURCED     (ClearSpan — not yet vetted)
 *   CONTACTED                   → CONTACTED
 *   PENDING_REPLY               → CONTACTED   (+ follow-up next action)
 *   APPLIED                     → IN_CONVERSATION
 *   APPROVED                    → AUTHORIZED
 *   LIVE                        → AUTHORIZED  (+ tag status:live)
 *   REJECTED                    → DECLINED
 *
 * Every migrated record keeps its old value as a `legacy:<OLD>` tag —
 * nothing is lost. Idempotent: records already carrying a legacy: tag
 * are skipped. The script verifies totals before/after and exits
 * non-zero on any drift (D1: stop and restore, never patch forward).
 *
 * Run: npx tsx scripts/migrate-stages.ts   (DATABASE_URL selects the DB)
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const MAP: Record<string, string> = {
  CONTACTED: "CONTACTED",
  PENDING_REPLY: "CONTACTED",
  APPLIED: "IN_CONVERSATION",
  APPROVED: "AUTHORIZED",
  LIVE: "AUTHORIZED",
  REJECTED: "DECLINED",
};

const FOLLOW_UP_ACTION = "Follow up — application sent, awaiting reply";

function fail(msg: string): never {
  console.error(`✗ DRIFT: ${msg}`);
  console.error("Stopping. Restore from dev.db.backup — do not patch forward.");
  process.exit(1);
}

async function main() {
  console.log(`Database: ${url}`);
  const before = await prisma.crmRecord.findMany({ orderBy: { name: "asc" } });
  const interactionsBefore = await prisma.interaction.count();
  console.log(`Before: ${before.length} records, ${interactionsBefore} interactions`);

  // Expected post-migration stage counts, computed from the pre-state.
  const expected: Record<string, number> = {};
  const bump = (s: string) => (expected[s] = (expected[s] ?? 0) + 1);
  for (const r of before) {
    const tags = JSON.parse(r.tags) as string[];
    if (tags.some((t) => t.startsWith("legacy:"))) {
      bump(r.status); // already migrated — expect unchanged
    } else if (r.status === "NOT_CONTACTED") {
      bump(r.rank ? "QUALIFIED" : "SOURCED");
    } else {
      bump(MAP[r.status] ?? fail(`unknown legacy stage "${r.status}" on ${r.name}`));
    }
  }

  // Apply.
  let seq = 0;
  let migrated = 0;
  for (const r of before) {
    seq += 1;
    const tags = JSON.parse(r.tags) as string[];
    const alreadyMigrated = tags.some((t) => t.startsWith("legacy:"));
    const recordId =
      r.recordId ?? `FDS-SUP-${String(seq).padStart(4, "0")}`;

    if (alreadyMigrated) {
      if (!r.recordId) {
        await prisma.crmRecord.update({ where: { id: r.id }, data: { recordId } });
      }
      continue;
    }

    const old = r.status;
    const next =
      old === "NOT_CONTACTED" ? (r.rank ? "QUALIFIED" : "SOURCED") : MAP[old];
    const newTags = [...tags, `legacy:${old}`];
    if (old === "LIVE") newTags.push("status:live");

    await prisma.crmRecord.update({
      where: { id: r.id },
      data: {
        recordId,
        status: next,
        tags: JSON.stringify(newTags),
        // PENDING_REPLY loses its "waiting" stage — preserve it as a
        // follow-up next action (D3) unless one is already set.
        ...(old === "PENDING_REPLY" && !r.nextAction
          ? {
              nextAction: FOLLOW_UP_ACTION,
              nextActionDate:
                r.nextActionDate ?? new Date(Date.now() + 2 * 86_400_000),
            }
          : {}),
      },
    });
    migrated += 1;
  }

  // Verify (D1).
  const after = await prisma.crmRecord.findMany();
  const interactionsAfter = await prisma.interaction.count();
  if (after.length !== before.length)
    fail(`record count ${after.length} ≠ ${before.length}`);
  if (interactionsAfter !== interactionsBefore)
    fail(`interaction count ${interactionsAfter} ≠ ${interactionsBefore}`);

  const counts: Record<string, number> = {};
  for (const r of after) counts[r.status] = (counts[r.status] ?? 0) + 1;
  for (const [stage, n] of Object.entries(expected)) {
    if (counts[stage] !== n)
      fail(`stage ${stage}: got ${counts[stage] ?? 0}, expected ${n}`);
  }
  for (const stage of Object.keys(counts)) {
    if (!(stage in expected)) fail(`unexpected stage ${stage} present`);
  }
  const missingIds = after.filter((r) => !r.recordId).length;
  if (missingIds) fail(`${missingIds} records without recordId`);

  console.log(`✓ Migrated ${migrated} records (${before.length - migrated} already done)`);
  console.log(`✓ Verified: ${after.length} records, ${interactionsAfter} interactions`);
  console.log("✓ Stage counts:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
