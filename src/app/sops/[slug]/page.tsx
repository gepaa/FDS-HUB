import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { marked } from "marked";
import { readSop } from "@/lib/sops";
import { GlassPanel } from "@/components/kit/GlassPanel";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const sop = readSop(slug);
  return { title: sop ? sop.title : "SOP" };
}

export default async function SopPage({ params }: Params) {
  const { slug } = await params;
  const sop = readSop(slug);
  if (!sop) notFound();

  const html = await marked.parse(sop.markdown, { gfm: true });

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/sops"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden />
        SOP Library
      </Link>
      <GlassPanel className="px-6 py-6 md:px-10 md:py-8">
        <article
          className="prose-doc"
          // Own docs from the repo — no untrusted input reaches this.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </GlassPanel>
    </div>
  );
}
