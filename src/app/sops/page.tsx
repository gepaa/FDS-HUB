import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { listSops } from "@/lib/sops";
import { GlassCard } from "@/components/kit/GlassCard";

export const metadata: Metadata = { title: "SOP Library" };
export const dynamic = "force-dynamic";

export default function SopsPage() {
  const entries = listSops();
  const groups = ["Operational SOPs", "Core context"] as const;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          SOP Library
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          📘 How Claude does everything. These files live in{" "}
          <code className="text-xs">docs/</code> — the context layer the agent
          reads before acting and updates as work happens. A new capability =
          a new SOP + a worker that follows it.
        </p>
      </header>

      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
            {group}
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {entries
              .filter((e) => e.group === group)
              .map((e) => (
                <Link key={e.slug} href={`/sops/${e.slug}`}>
                  <GlassCard className="press h-full p-4 transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center gap-2">
                      <BookOpen
                        size={15}
                        aria-hidden
                        className="text-accent-bright"
                      />
                      <p className="text-sm font-semibold text-ink">
                        {e.title}
                      </p>
                      <span
                        className={
                          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold " +
                          (e.status === "live"
                            ? "bg-[var(--accent-soft)] text-accent-bright"
                            : "bg-[var(--amber-soft)] text-amber")
                        }
                      >
                        {e.status === "live" ? "LIVE" : "TO DRAFT"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{e.excerpt}</p>
                  </GlassCard>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
