import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  ClutchTimeline,
  type ClutchDTO,
} from "@/components/clutch/ClutchTimeline";

export const metadata: Metadata = { title: "Clutch Timeline" };
export const dynamic = "force-dynamic";

export default async function ClutchPage() {
  const clutches = await prisma.clutch.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 1000,
  });

  const dtos: ClutchDTO[] = clutches.map((c) => ({
    id: c.id,
    title: c.title,
    notes: c.notes,
    date: c.date.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Clutch Timeline</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Every batch of work we knock down, plotted on the day it landed. The
          timeline opens three months back at the origin — <em>Started E10</em>{" "}
          — and runs forward to today. Add a clutch and it drops onto the line.
        </p>
      </header>
      <ClutchTimeline initial={dtos} />
    </div>
  );
}
