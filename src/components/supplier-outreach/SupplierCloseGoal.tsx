import { Target, Trophy } from "lucide-react";
import {
  SUPPLIER_CLOSE_GOAL,
  supplierCloseGoalProgress,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SupplierCloseGoal({
  authorizedCount,
}: {
  authorizedCount: number;
}) {
  const progress = supplierCloseGoalProgress(authorizedCount);

  return (
    <section className="surface-raised rounded-panel p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            progress.reached
              ? "bg-[var(--green-soft)] text-[var(--green)]"
              : "bg-[var(--accent-soft)] text-[var(--accent-bright)]",
          )}
        >
          {progress.reached ? (
            <Trophy size={20} aria-hidden />
          ) : (
            <Target size={20} aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                Supplier close goal
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                Close 20 new suppliers
              </h2>
            </div>
            <p className="num text-sm font-semibold text-ink">
              {progress.completed} / {SUPPLIER_CLOSE_GOAL.additionalTarget}
            </p>
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]"
            role="progressbar"
            aria-label="New supplier close goal"
            aria-valuemin={0}
            aria-valuemax={SUPPLIER_CLOSE_GOAL.additionalTarget}
            aria-valuenow={progress.completed}
          >
            <div
              className="h-full rounded-full bg-[var(--green)] transition-[width]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              Started with {SUPPLIER_CLOSE_GOAL.baselineAuthorized} approved
            </span>
            <span>
              {authorizedCount} approved now · target{" "}
              {SUPPLIER_CLOSE_GOAL.targetAuthorized}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
