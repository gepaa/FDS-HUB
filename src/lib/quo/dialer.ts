import { telHref, displayPhone } from "@/lib/quo/phone";

/**
 * Outbound calling — the provider seam.
 *
 * THE HONEST POSITION: Quo's public API has no endpoint that starts a
 * call. There is no `POST /calls`. There is no browser voice SDK, and
 * no embeddable softphone. Every "click to call from your CRM"
 * integration Quo documents works the same way ours does — by handing a
 * `tel:` link to the Quo desktop application, which registers itself as
 * the operating system's default handler for telephone links.
 *
 * So this CRM does not pretend to carry audio. It hands off, and then
 * owns the record of what happened: the webhook tells us the call
 * started, and the transcript, recording and summary land against the
 * lead a few seconds after it ends.
 *
 * The seam exists so that stays true only for as long as it has to. A
 * future provider that CAN carry browser audio implements the same
 * interface and every lead screen keeps working unchanged — which is
 * the whole reason the UI calls `initiateCall()` instead of building a
 * `tel:` href inline.
 */

export type DialMode =
  /** Hand off to a desktop app via a `tel:` link. Quo, today. */
  | "handoff"
  /** Open a provider web dialler in a popup. Not yet available on Quo. */
  | "browser"
  /** Carry audio inside our own page. No provider supports this here. */
  | "embedded"
  /** We have nothing dialable — usually a missing/invalid number. */
  | "unsupported";

export interface DialTarget {
  /** The customer's number, in any format. */
  phone: string | null | undefined;
  /** Which of our Quo numbers to call from, when the provider can. */
  fromPhoneNumberId?: string | null;
  /** Deep link to this conversation in Quo, when we have one. */
  providerLink?: string | null;
  region?: string;
}

export interface DialResult {
  mode: DialMode;
  /** What the UI should navigate to, if anything. */
  href: string | null;
  /** Secondary link: open the conversation in Quo's own app. */
  providerHref: string | null;
  /** Shown to the salesperson. Plain language, no jargon. */
  instruction: string;
  /** Pretty version of the number being dialled. */
  display: string;
}

export interface CommunicationDialer {
  readonly provider: string;
  readonly mode: DialMode;
  initiateCall(target: DialTarget): DialResult;
}

/**
 * Quo implementation: returns a launch instruction rather than carrying
 * a call. `tel:` is the documented, supported path — the desktop app
 * claims the protocol during install.
 */
export const quoDialer: CommunicationDialer = {
  provider: "quo",
  mode: "handoff",

  initiateCall(target: DialTarget): DialResult {
    const region = target.region ?? "US";
    const href = telHref(target.phone, region);
    const display = displayPhone(target.phone, region);
    const providerHref = target.providerLink ?? null;

    if (!href) {
      return {
        mode: "unsupported",
        href: null,
        providerHref,
        instruction:
          "No usable telephone number on this record — add one before calling.",
        display: "",
      };
    }

    return {
      mode: "handoff",
      href,
      providerHref,
      instruction:
        "Opens Quo and dials the number. Keep this window open — the call " +
        "history is synced to this record automatically when it ends.",
      display,
    };
  },
};

/**
 * The dialler the app uses. A single named export so swapping providers
 * is a one-line change rather than a search across the UI.
 */
export function getDialer(): CommunicationDialer {
  return quoDialer;
}
