import type {
  CommsActivity,
  CallArtifact,
  CallExtraction as CallExtractionRow,
  HqTask,
} from "@/generated/prisma/client";

/**
 * Wire shapes for the call UI.
 *
 * Two sizes on purpose. The timeline gets `CallSummaryDTO`, which
 * carries availability flags but NOT transcript text, summary text or
 * recording URLs — a lead with forty calls would otherwise ship
 * megabytes of transcripts to the browser on open (§24). The full
 * `CallDetailDTO` is fetched only when a salesperson expands one call.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

const jsonArray = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export interface CallSummaryDTO {
  id: string;
  providerActivityId: string;
  direction: string;
  status: string;
  missed: boolean;
  voicemail: boolean;
  aiHandled: string | null;
  externalNumber: string | null;
  durationSec: number | null;
  startedAt: string | null;
  answeredAt: string | null;
  completedAt: string | null;
  answeredByUserId: string | null;
  providerPhoneNumberId: string | null;
  providerLink: string | null;
  reviewedAt: string | null;
  /** Availability only — the content itself is fetched on expand. */
  hasRecording: boolean;
  recordingSegments: number;
  hasTranscript: boolean;
  hasSummary: boolean;
  hasExtraction: boolean;
  needsHumanReview: boolean;
  intentScore: number | null;
  /** Processing state, so the UI can say "still arriving" honestly. */
  transcriptStatus: string | null;
  summaryStatus: string | null;
}

export function toCallSummaryDTO(
  activity: CommsActivity & {
    artifacts?: CallArtifact[];
    extraction?: CallExtractionRow | null;
  },
): CallSummaryDTO {
  const artifacts = activity.artifacts ?? [];
  const recordings = artifacts.filter((a) => a.kind === "recording");
  const transcript = artifacts.find((a) => a.kind === "transcript");
  const summary = artifacts.find((a) => a.kind === "summary");

  return {
    id: activity.id,
    providerActivityId: activity.providerActivityId,
    direction: activity.direction,
    status: activity.status,
    missed: activity.missed,
    voicemail: activity.voicemail,
    aiHandled: activity.aiHandled,
    externalNumber: activity.externalNumber,
    durationSec: activity.durationSec,
    startedAt: iso(activity.startedAt),
    answeredAt: iso(activity.answeredAt),
    completedAt: iso(activity.completedAt),
    answeredByUserId: activity.answeredByUserId,
    providerPhoneNumberId: activity.providerPhoneNumberId,
    providerLink: activity.providerLink,
    reviewedAt: iso(activity.reviewedAt),
    hasRecording: recordings.some((r) => r.providerUrl || r.storageKey),
    recordingSegments: recordings.length,
    hasTranscript: Boolean(transcript?.text),
    hasSummary: Boolean(summary?.bullets),
    hasExtraction: activity.extraction?.status === "completed",
    needsHumanReview: activity.extraction?.needsHumanReview ?? false,
    intentScore: activity.extraction?.intentScore ?? null,
    transcriptStatus: transcript?.status ?? null,
    summaryStatus: summary?.status ?? null,
  };
}

export interface TranscriptSegmentDTO {
  content: string;
  start: number;
  end: number;
  /** Who spoke: "customer" | "team" — resolved server-side. */
  speaker: "customer" | "team" | "unknown";
}

export interface CallDetailDTO extends CallSummaryDTO {
  recordings: {
    segmentIndex: number;
    durationSec: number | null;
    mimeType: string | null;
    /** Our proxy URL — never Quo's URL. */
    src: string;
    status: string;
  }[];
  transcript: {
    status: string;
    text: string | null;
    segments: TranscriptSegmentDTO[];
  } | null;
  /** Quo's own output, kept verbatim and never edited. */
  providerSummary: {
    status: string;
    bullets: string[];
    nextSteps: string[];
  } | null;
  /** Our extraction, editable by a human. */
  extraction: {
    status: string;
    model: string | null;
    data: unknown;
    crmNote: string | null;
    crmNoteEditedAt: string | null;
    intentScore: number | null;
    needsHumanReview: boolean;
    humanConfirmed: boolean;
  } | null;
  followUp: {
    id: string;
    title: string;
    detail: string | null;
    status: string;
    dueDate: string | null;
    priority: string | null;
    aiGenerated: boolean;
    humanConfirmed: boolean;
  } | null;
}

export function toCallDetailDTO(
  activity: CommsActivity & {
    artifacts: CallArtifact[];
    extraction?: CallExtractionRow | null;
    tasks?: HqTask[];
  },
): CallDetailDTO {
  const base = toCallSummaryDTO(activity);
  const recordings = activity.artifacts
    .filter((a) => a.kind === "recording")
    .sort((a, b) => a.segmentIndex - b.segmentIndex);
  const transcript = activity.artifacts.find((a) => a.kind === "transcript");
  const summary = activity.artifacts.find((a) => a.kind === "summary");
  const task = (activity.tasks ?? []).find((t) => t.source === "quo_call");

  return {
    ...base,
    recordings: recordings.map((r) => ({
      segmentIndex: r.segmentIndex,
      durationSec: r.durationSec,
      mimeType: r.mimeType,
      // Audio is served through our own permission-checked route. Quo's
      // URL is deliberately not exposed to the browser.
      src: `/api/calls/${activity.id}/recording/${r.segmentIndex}`,
      status: r.status,
    })),
    transcript: transcript
      ? {
          status: transcript.status,
          text: transcript.text,
          segments: parseSegments(transcript.dialogue),
        }
      : null,
    providerSummary: summary
      ? {
          status: summary.status,
          bullets: jsonArray(summary.bullets),
          nextSteps: jsonArray(summary.nextSteps),
        }
      : null,
    extraction: activity.extraction
      ? {
          status: activity.extraction.status,
          model: activity.extraction.model,
          data: safeJson(activity.extraction.data),
          crmNote: activity.extraction.crmNote,
          crmNoteEditedAt: iso(activity.extraction.crmNoteEditedAt),
          intentScore: activity.extraction.intentScore,
          needsHumanReview: activity.extraction.needsHumanReview,
          humanConfirmed: activity.extraction.humanConfirmed,
        }
      : null,
    followUp: task
      ? {
          id: task.id,
          title: task.title,
          detail: task.detail,
          status: task.status,
          dueDate: iso(task.dueDate),
          priority: task.priority,
          aiGenerated: task.aiGenerated,
          humanConfirmed: task.humanConfirmed,
        }
      : null,
  };
}

/**
 * Resolve speakers without leaking Quo user ids to the browser. A
 * segment with a Quo userId is one of ours; one with a phone number is
 * the customer.
 */
function parseSegments(raw: string | null): TranscriptSegmentDTO[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      content?: unknown;
      start?: unknown;
      end?: unknown;
      identifier?: unknown;
      userId?: unknown;
    }[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => typeof s.content === "string")
      .map((s) => ({
        content: String(s.content),
        start: typeof s.start === "number" ? s.start : 0,
        end: typeof s.end === "number" ? s.end : 0,
        speaker:
          typeof s.userId === "string" && s.userId
            ? ("team" as const)
            : typeof s.identifier === "string" && s.identifier
              ? ("customer" as const)
              : ("unknown" as const),
      }));
  } catch {
    return [];
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
