import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { QuoIntegrationPanel } from "@/components/settings/QuoIntegrationPanel";

export const metadata: Metadata = { title: "Quo integration" };
export const dynamic = "force-dynamic";

export default function QuoIntegrationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Integrations
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-ink">
          <Phone className="h-5 w-5 text-muted" aria-hidden />
          Quo (phone)
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Calls, recordings, transcripts and summaries sync from Quo onto the
          matching lead. Calls themselves are placed in the Quo app — the CRM
          keeps the record of what happened.
        </p>
      </div>

      <QuoIntegrationPanel />

      <GlassPanel className="p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          How calling works
        </h2>
        <div className="mt-3 space-y-3 text-sm text-ink">
          <p>
            Quo&apos;s API has no endpoint for starting a call, and no
            browser-embeddable dialler. Pressing{" "}
            <span className="font-medium">Call</span> on a lead therefore hands
            the number to the Quo desktop app through a <code>tel:</code> link —
            the same mechanism Quo&apos;s own CRM integrations use. Everyone who
            makes calls needs the Quo desktop app installed and set as their
            default calling app.
          </p>
          <p className="text-muted">
            Inbound calls need no setup at all: the alert appears the moment the
            phone rings, and the write-up lands on the lead a few seconds after
            it ends.
          </p>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Recording consent
        </h2>
        <p className="mt-3 text-sm text-muted">
          Call recording and transcription laws differ by country and by state,
          and several places require every participant to consent. FDS must
          confirm what applies in each region it calls into before enabling
          recording — this software cannot make that determination, and nothing
          here should be read as legal advice.
        </p>
      </GlassPanel>
    </div>
  );
}
