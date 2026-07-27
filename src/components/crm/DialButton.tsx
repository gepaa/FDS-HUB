"use client";

import { useState } from "react";
import { PhoneOutgoing } from "lucide-react";
import { getDialer } from "@/lib/quo/dialer";

/**
 * The "call this lead" button.
 *
 * It goes through the dialler abstraction rather than building a
 * `tel:` href inline. That indirection is the whole point: Quo cannot
 * carry audio in a browser today, but if a provider that can is added
 * later, only `getDialer()` changes — this component, and every screen
 * using it, keeps working.
 *
 * The first press explains what is about to happen, because a window
 * appearing from nowhere is alarming and the behaviour is not obvious.
 */
export function DialButton({
  phone,
  providerLink,
  region = "US",
}: {
  phone: string | null | undefined;
  providerLink?: string | null;
  region?: string;
}) {
  const [explained, setExplained] = useState(false);
  const dial = getDialer().initiateCall({ phone, providerLink, region });

  if (dial.mode === "unsupported" || !dial.href) {
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline px-3 text-[13px] text-muted"
        title={dial.instruction}
      >
        <PhoneOutgoing size={13} aria-hidden />
        No number
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <a
        href={dial.href}
        onClick={() => setExplained(true)}
        className="press inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] font-medium text-ink shadow-sm hover:border-[var(--hairline-strong)]"
        title={dial.instruction}
      >
        <PhoneOutgoing size={13} aria-hidden />
        Dial {dial.display}
      </a>
      {explained ? (
        <span
          role="status"
          className="surface-raised absolute top-full left-0 z-10 mt-1 w-64 rounded-md border border-hairline p-2 text-xs text-muted shadow-sm"
        >
          {dial.instruction}
        </span>
      ) : null}
    </span>
  );
}
