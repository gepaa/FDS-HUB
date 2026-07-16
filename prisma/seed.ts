/**
 * Seed the CRM from the real FDS Supplier Outreach sheet
 * (data/suppliers.csv) and verify the known totals:
 *
 *   100 suppliers · ranks 50 Gold / 46 Silver / 3 Bronze / 1 unranked
 *   pipeline 96 Not Contacted / 2 Contacted / 2 Pending Reply
 *   clusters 33/18/11/7/7/4/4/16
 *
 * Idempotent: wipes and re-seeds supplier data on every run.
 * Run with: npx prisma db seed   (or: npm run db:seed)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseSupplierCsv } from "../src/lib/csv";
import { assignCluster } from "../src/lib/clusters";
import { CLUSTERS, STAGES } from "../src/lib/domain";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const EXPECTED = {
  total: 100,
  ranks: { Gold: 50, Silver: 46, Bronze: 3, unranked: 1 },
  stages: { NOT_CONTACTED: 96, CONTACTED: 2, PENDING_REPLY: 2 },
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

async function main() {
  const csvPath = join(__dirname, "..", "data", "suppliers.csv");
  const text = readFileSync(csvPath, "utf-8");
  const parsed = parseSupplierCsv(text);

  console.log(`Parsed ${parsed.length} suppliers from ${csvPath}`);

  await prisma.interaction.deleteMany();
  await prisma.supplier.deleteMany();

  for (const s of parsed) {
    const cluster = s.cluster ?? assignCluster(s.name, s.niche);
    await prisma.supplier.create({
      data: {
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
        stage: s.stage,
        nextAction: s.nextAction,
        notes: s.notes,
        source: "FDS Supplier Outreach sheet",
        // Real outreach activity from the sheet becomes the first
        // interaction log entry.
        interactions: s.activityNote
          ? {
              create: [{ type: "note", body: s.activityNote }],
            }
          : undefined,
      },
    });
  }

  await prisma.healthCheck.create({ data: { note: "seeded" } });

  // ---- verify totals ----
  const all = await prisma.supplier.findMany();
  const count = (fn: (s: (typeof all)[number]) => boolean) =>
    all.filter(fn).length;

  const rankCounts = {
    Gold: count((s) => s.rank === "Gold"),
    Silver: count((s) => s.rank === "Silver"),
    Bronze: count((s) => s.rank === "Bronze"),
    unranked: count((s) => !s.rank),
  };
  const stageCounts = Object.fromEntries(
    STAGES.map((st) => [st.id, count((s) => s.stage === st.id)]),
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
    console.log("\n✔ Seed verified: 100 suppliers, 50/46/3/1 ranks, 96/2/2 pipeline, clusters 33/18/11/7/7/4/4/16");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
