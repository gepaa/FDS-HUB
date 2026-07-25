/**
 * Ad Budget Watch — the runout math.
 *
 * The whole point of this surface: keep money on the ad account so the
 * business card never declines mid-campaign. Given a balance and a
 * daily spend, we project when the account runs dry and how urgent the
 * top-up is. Pure functions — no DB, no dates-from-storage ambiguity;
 * callers pass `now` so the cron and the UI agree.
 */

export interface AdAccountLike {
  balance: number;
  dailyBudget: number;
  /**
   * Remind when this many DAYS of runway (or fewer) remain. This is the
   * knob Pablo actually thinks in — "tell me when I'm ~2 days from
   * empty." Stored on the account as `thresholdDays`.
   */
  thresholdDays: number;
}

export type BudgetSeverity = "ok" | "warn" | "critical" | "empty";

export interface RunoutProjection {
  /** Whole + fractional days of runway left (Infinity if no spend set). */
  daysLeft: number;
  /** Days floored — "you have N full days". */
  daysLeftWhole: number;
  /** Projected dry date (null when there's no spend to project against). */
  runoutDate: Date | null;
  /** Runway state used to colour + gate the reminder. */
  severity: BudgetSeverity;
  /** True when the human should be nudged to top up now. */
  needsTopUp: boolean;
  /** The balance (in currency) at/under which the reminder trips. */
  thresholdAmount: number;
  /** Suggested top-up to get back to ~14 days of runway. */
  suggestedTopUp: number;
}

const RUNWAY_TARGET_DAYS = 14; // a comfortable buffer to refill toward

/**
 * Project runout for one account.
 *
 * Reminder rule (how Pablo described it): "tell me before it runs out."
 * `thresholdDays` is the number of days of runway at/under which we
 * nudge — e.g. 3 → warn once you're within 3 days of empty. Critical
 * when inside half that window; empty at a zero balance.
 */
export function projectRunout(
  account: AdAccountLike,
  now: Date = new Date(),
): RunoutProjection {
  const balance = Math.max(0, account.balance);
  const daily = account.dailyBudget;
  const thresholdDays = Math.max(0.5, account.thresholdDays || 3);
  const thresholdAmount = daily > 0 ? daily * thresholdDays : 0;

  if (daily <= 0) {
    // No spend configured — we can't project; only flag a truly empty
    // account, otherwise it's "ok / set a daily budget".
    return {
      daysLeft: balance > 0 ? Infinity : 0,
      daysLeftWhole: balance > 0 ? Infinity : 0,
      runoutDate: null,
      severity: balance > 0 ? "ok" : "empty",
      needsTopUp: balance <= 0,
      thresholdAmount: 0,
      suggestedTopUp: 0,
    };
  }

  const daysLeft = balance / daily;
  const runoutDate = new Date(now.getTime() + daysLeft * 86_400_000);

  let severity: BudgetSeverity;
  if (balance <= 0) severity = "empty";
  else if (daysLeft <= thresholdDays / 2) severity = "critical";
  else if (daysLeft <= thresholdDays) severity = "warn";
  else severity = "ok";

  const suggestedTopUp =
    daysLeft < RUNWAY_TARGET_DAYS
      ? roundMoney(daily * RUNWAY_TARGET_DAYS - balance)
      : 0;

  return {
    daysLeft,
    daysLeftWhole: Math.floor(daysLeft),
    runoutDate,
    severity,
    needsTopUp: severity === "warn" || severity === "critical" || severity === "empty",
    thresholdAmount: roundMoney(thresholdAmount),
    suggestedTopUp,
  };
}

/** "$1,240.00" — money formatting shared by UI + notifications. */
export function money(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${roundMoney(amount).toFixed(2)}`;
  }
}

/** Human runway phrase, e.g. "2 days left" / "runs dry today". */
export function runwayPhrase(p: RunoutProjection): string {
  if (p.daysLeft === Infinity) return "set a daily budget to project";
  if (p.daysLeft <= 0) return "account is empty";
  if (p.daysLeft < 1) return "runs dry today";
  const d = p.daysLeftWhole;
  return `${d} day${d === 1 ? "" : "s"} left`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
