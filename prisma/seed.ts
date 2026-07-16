/**
 * Seed the CRM from the real FDS Supplier Outreach sheet
 * (data/suppliers.csv) and verify the known totals:
 *
 *   100 suppliers · ranks 50 Gold / 46 Silver / 3 Bronze / 1 unranked
 *   pipeline (spec ladder, D3 mapping): 1 Sourced / 95 Qualified / 4 Contacted
 *   clusters 33/18/11/7/7/4/4/16
 *
 * Stage mapping mirrors scripts/migrate-stages.ts so a re-seed
 * reproduces the migrated state: ranked "not contacted" rows enter at
 * QUALIFIED, unranked at SOURCED, "pending reply" → CONTACTED with a
 * follow-up next action, and every row keeps a legacy:* tag.
 *
 * Idempotent: wipes and re-seeds record data on every run.
 * Run with: npx prisma db seed   (or: npm run db:seed)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseSupplierCsv, type ParsedSupplier } from "../src/lib/csv";
import { assignCluster } from "../src/lib/clusters";
import { CLUSTERS, SUPPLIER_STAGES } from "../src/lib/domain";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const EXPECTED = {
  total: 100,
  ranks: { Gold: 50, Silver: 46, Bronze: 3, unranked: 1 },
  stages: { SOURCED: 1, QUALIFIED: 95, CONTACTED: 4 },
  clusters: {
    "Tractor/Skid Attachments": 33,
    "Livestock Handling": 18,
    "Greenhouses/High Tunnels": 11,
    Fencing: 7,
    Sprayers: 7,
    Irrigation: 4,
    Trailers: 4,
    Other: 16,
  } as Record<string, number>,
};

/** The legacy:* tag from the sheet's raw status text (D3 mapping). */
function legacyTag(s: ParsedSupplier): string {
  const raw = (s.rawStatus ?? "not contacted")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return `legacy:${raw}`;
}

const FOLLOW_UP_ACTION = "Follow up — application sent, awaiting reply";

async function main() {
  const csvPath = join(__dirname, "..", "data", "suppliers.csv");
  const text = readFileSync(csvPath, "utf-8");
  const parsed = parseSupplierCsv(text);

  console.log(`Parsed ${parsed.length} suppliers from ${csvPath}`);

  await prisma.interaction.deleteMany();
  await prisma.crmRecord.deleteMany();

  let seq = 0;
  for (const s of parsed) {
    seq += 1;
    const cluster = s.cluster ?? assignCluster(s.name, s.niche);
    await prisma.crmRecord.create({
      data: {
        recordId: `FDS-SUP-${String(seq).padStart(4, "0")}`,
        type: "supplier",
        name: s.name,
        niche: s.niche,
        cluster,
        bestSeller: s.bestSeller,
        rank: s.rank,
        websiteUrl: s.websiteUrl,
        dealerAppUrl: s.dealerAppUrl,
        mainContact: s.mainContact,
        email: s.email,
        phone: s.phone,
        status: s.status,
        tags: JSON.stringify([legacyTag(s)]),
        nextAction:
          s.nextAction ??
          (legacyTag(s) === "legacy:PENDING_REPLY" ? FOLLOW_UP_ACTION : null),
        notes: s.notes,
        source: "FDS Supplier Outreach sheet",
        // Real outreach activity from the sheet becomes the first
        // interaction log entry.
        interactions: s.activityNote
          ? {
              create: [{ type: "note", actor: "you", body: s.activityNote }],
            }
          : undefined,
      },
    });
  }

  await prisma.healthCheck.create({ data: { note: "seeded" } });

  // ---- verify totals ----
  const all = await prisma.crmRecord.findMany();
  const count = (fn: (s: (typeof all)[number]) => boolean) =>
    all.filter(fn).length;

  const rankCounts = {
    Gold: count((s) => s.rank === "Gold"),
    Silver: count((s) => s.rank === "Silver"),
    Bronze: count((s) => s.rank === "Bronze"),
    unranked: count((s) => !s.rank),
  };
  const stageCounts = Object.fromEntries(
    SUPPLIER_STAGES.map((st) => [st.id, count((s) => s.status === st.id)]),
  );
  const clusterCounts = Object.fromEntries(
    CLUSTERS.map((c) => [c, count((s) => s.cluster === c)]),
  );

  console.log("Total:", all.length);
  console.log("Ranks:", rankCounts);
  console.log("Stages:", stageCounts);
  console.log("Clusters:", clusterCounts);

  const problems: string[] = [];
  if (all.length !== EXPECTED.total)
    problems.push(`total ${all.length} ≠ ${EXPECTED.total}`);
  for (const [k, v] of Object.entries(EXPECTED.ranks)) {
    const actual = rankCounts[k as keyof typeof rankCounts];
    if (actual !== v) problems.push(`rank ${k}: ${actual} ≠ ${v}`);
  }
  for (const [k, v] of Object.entries(EXPECTED.stages)) {
    if (stageCounts[k] !== v) problems.push(`stage ${k}: ${stageCounts[k]} ≠ ${v}`);
  }
  for (const [k, v] of Object.entries(EXPECTED.clusters)) {
    if (clusterCounts[k] !== v)
      problems.push(`cluster ${k}: ${clusterCounts[k]} ≠ ${v}`);
  }

  if (problems.length) {
    console.error("\nSEED VERIFICATION FAILED:");
    for (const p of problems) console.error(" -", p);
    // Show which suppliers landed in mismatched clusters to debug fast.
    for (const c of CLUSTERS) {
      console.error(
        `\n${c} (${clusterCounts[c]}):`,
        all.filter((s) => s.cluster === c).map((s) => s.name).join(" | "),
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      "\n✔ Seed verified: 100 suppliers, 50/46/3/1 ranks, 1/95/4 pipeline (Sourced/Qualified/Contacted), clusters 33/18/11/7/7/4/4/16",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
