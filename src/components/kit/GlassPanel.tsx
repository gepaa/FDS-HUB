import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional corner glow tint for hero surfaces. */
  glow?: "green" | "amber" | "none";
  /** Denser surface for layered UI (drawers, popovers). */
  strong?: boolean;
}

/**
 * The base liquid-glass surface: frosted blur, hairline border,
 * soft shadow, top-edge highlight. Every panel in the app is one
 * of these.
 */
export function GlassPanel({
  glow = "none",
  strong = false,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "relative overflow-hidden rounded-panel",
        className,
      )}
      {...rest}
    >
      {glow !== "none" && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
          style={{
            background:
              glow === "green" ? "var(--orb-green)" : "var(--orb-amber)",
          }}
        />
      )}
      {children}
    </div>
  );
}
