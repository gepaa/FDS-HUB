/**
 * Docs and links pinned to a to-do.
 *
 * Files are stored inline in the row. The hub has no blob store, and the
 * things that get attached here — a supplier quote, a spec sheet, a
 * screenshot of an invoice — are small. The cap sits below Vercel's
 * 4.5 MB serverless request limit so an oversized upload fails with a
 * readable message from us rather than an opaque 413 from the platform.
 * Anything bigger belongs in Drive with a link on the card.
 */

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export function humanSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Accept only http(s) links.
 *
 * Rejecting every other scheme is the point: a stored `javascript:` or
 * `data:` URL becomes a scripted click for whoever opens the card next,
 * and these cards are shared across the team.
 */
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A bare "docs.google.com/..." is what people actually paste.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

/** A readable label when the user didn't type one: host + last path segment. */
export function labelForLink(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last
      ? `${u.hostname}/${decodeURIComponent(last)}`.slice(0, 120)
      : u.hostname;
  } catch {
    return url.slice(0, 120);
  }
}

/**
 * Strip a client-supplied filename down to something safe to echo back in
 * a Content-Disposition header — no path separators, no quotes, and no
 * control characters (a newline there would let the name split headers).
 */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) return false;
      return ch !== '"' && ch !== "'" && ch !== "\\";
    })
    .join("")
    .trim();
  return cleaned.slice(0, 120) || "file";
}
