import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The SOP Library reads the context layer straight from docs/ — the
 * same files the agent reads before acting (Blueprint §3 Layer 1).
 * Server-only.
 */

const DOCS_DIR = join(process.cwd(), "docs");

export interface SopEntry {
  slug: string; // e.g. "FDS_Master_Plan" or "sops__Nightly_Run_SOP"
  title: string;
  group: "Core context" | "Operational SOPs";
  status: "live" | "stub";
  excerpt: string;
}

function entryFor(dir: string, file: string, group: SopEntry["group"]): SopEntry {
  const raw = readFileSync(join(dir, file), "utf-8");
  const firstHeading = raw.match(/^#\s+(.+)$/m)?.[1] ?? file.replace(/\.md$/, "");
  const excerptLine =
    raw.match(/^###\s+(.+)$/m)?.[1] ??
    raw
      .split("\n")
      .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">")) ??
    "";
  return {
    slug:
      group === "Operational SOPs"
        ? `sops__${file.replace(/\.md$/, "")}`
        : file.replace(/\.md$/, ""),
    title: firstHeading.replace(/^Farming Direct Supply\s+—\s+/, "").replace(/^Farmer Direct Supply\s+—\s+/, "").replace(/^FDS\s+(HQ\s+)?—\s+/, ""),
    group,
    status: raw.includes("Status: stub") ? "stub" : "live",
    excerpt: excerptLine.replace(/\*/g, "").slice(0, 160),
  };
}

export function listSops(): SopEntry[] {
  const core = readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => entryFor(DOCS_DIR, f, "Core context"));
  const sopsDir = join(DOCS_DIR, "sops");
  const sops = existsSync(sopsDir)
    ? readdirSync(sopsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => entryFor(sopsDir, f, "Operational SOPs"))
    : [];
  return [...sops, ...core];
}

/** Resolve a slug back to file content. Rejects anything path-like. */
export function readSop(slug: string): { title: string; markdown: string } | null {
  if (!/^[A-Za-z0-9_]+(__[A-Za-z0-9_]+)?$/.test(slug)) return null;
  const path = slug.startsWith("sops__")
    ? join(DOCS_DIR, "sops", `${slug.slice(6)}.md`)
    : join(DOCS_DIR, `${slug}.md`);
  if (!existsSync(path)) return null;
  const markdown = readFileSync(path, "utf-8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? slug;
  return { title, markdown };
}
