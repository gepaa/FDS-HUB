import { prisma } from "@/lib/prisma";
import { projectRunout, money, runwayPhrase } from "@/lib/ad-budget";
import { notify } from "@/lib/notify";

/**
 * The low-balance alert engine. Shared by the daily cron and the
 * manual "check now" button so both behave identically.
 *
 * For each active account we project runout; if it needs a top-up we
 * push a Discord notification — but only once per severity crossing.
 * Dedupe: we don't re-alert the same account at the same severity
 * within `DEDUPE_HOURS`, so the daily cron nudges once, not forever.
 */

const DEDUPE_HOURS = 20; // < 24h so a daily cron can re-nudge the next day
const HUB_URL = "/ad-budget";

export interface AlertOutcome {
  accountId: string;
  accountName: string;
  severity: string;
  daysLeft: number;
  alerted: boolean;
  delivered: boolean;
  reason?: string;
}

export async function checkAndAlert(now: Date = new Date()): Promise<{
  checked: number;
  alerted: AlertOutcome[];
}> {
  const accounts = await prisma.adAccount.findMany({ where: { active: true } });
  const outcomes: AlertOutcome[] = [];

  for (const acc of accounts) {
    const p = projectRunout(acc, now);
    const base: AlertOutcome = {
      accountId: acc.id,
      accountName: acc.name,
      severity: p.severity,
      daysLeft: p.daysLeft === Infinity ? Infinity : Math.round(p.daysLeft * 10) / 10,
      alerted: false,
      delivered: false,
    };

    if (!p.needsTopUp) {
      base.reason = "healthy";
      outcomes.push(base);
      continue;
    }

    // Dedupe on account + severity band within the window.
    const since = new Date(now.getTime() - DEDUPE_HOURS * 3_600_000);
    const recent = await prisma.alertLog.findFirst({
      where: {
        accountId: acc.id,
        kind: p.severity === "empty" ? "runout" : "low_balance",
        severity: p.severity === "critical" || p.severity === "empty" ? "critical" : "warn",
        createdAt: { gte: since },
      },
    });
    if (recent) {
      base.reason = "already alerted recently";
      outcomes.push(base);
      continue;
    }

    const severity = p.severity === "critical" || p.severity === "empty" ? "critical" : "warn";
    const title =
      p.severity === "empty"
        ? `⛔ ${acc.name} is OUT of ad budget`
        : `Ad budget low — ${acc.name}`;
    const lines = [
      `Balance: ${money(acc.balance, acc.currency)}`,
      `Daily spend: ${money(acc.dailyBudget, acc.currency)}`,
      p.runoutDate
        ? `Runs dry: ${p.runoutDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} (${runwayPhrase(p)})`
        : runwayPhrase(p),
      p.suggestedTopUp > 0
        ? `Top up ~${money(p.suggestedTopUp, acc.currency)} to get back to ~2 weeks of runway.`
        : "Add funds now so the card doesn't decline.",
    ];
    const bodyText = lines.join("\n");

    const result = await notify({
      title,
      body: bodyText,
      severity: severity === "critical" ? "critical" : "warn",
      url: HUB_URL,
    });

    await prisma.alertLog.create({
      data: {
        accountId: acc.id,
        kind: p.severity === "empty" ? "runout" : "low_balance",
        severity,
        channel: result.channel,
        title,
        body: bodyText,
        delivered: result.delivered,
      },
    });

    base.alerted = true;
    base.delivered = result.delivered;
    base.reason = result.delivered
      ? `pushed via ${result.channel}`
      : (result.error ?? "no channel wired");
    outcomes.push(base);
  }

  return { checked: accounts.length, alerted: outcomes };
}
