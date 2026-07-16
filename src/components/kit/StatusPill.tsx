import { cn } from "@/lib/utils";

type Status = "connected" | "disconnected" | "error" | "planned";

interface StatusPillProps {
  status: Status;
  label: string;
  className?: string;
  /** Pulse the dot (live connections). */
  pulse?: boolean;
}

const dotColor: Record<Status, string> = {
  connected: "var(--accent-bright)",
  disconnected: "var(--muted)",
  error: "var(--red)",
  planned: "var(--amber)",
};

/** Status is never color-alone: the label always names the state. */
export function StatusPill({ status, label, pulse, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "glass-soft inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted",
        status === "connected" && "text-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: dotColor[status],
          animation:
            pulse && status === "connected"
              ? "status-pulse 2.4s ease-in-out infinite"
              : undefined,
        }}
      />
      {label}
    </span>
  );
}
