import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Raised surface for layered UI (drawers, popovers). */
  strong?: boolean;
}

/**
 * The base panel surface: solid background, hairline border, soft
 * shadow. Every panel in the app is one of these.
 */
export function GlassPanel({
  strong = false,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        strong ? "surface-raised" : "surface",
        "relative overflow-hidden rounded-panel",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
