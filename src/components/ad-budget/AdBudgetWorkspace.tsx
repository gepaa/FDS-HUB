"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Check,
  DollarSign,
  Gauge,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { StatTile } from "@/components/kit/StatTile";
import { useToast } from "@/components/kit/Toast";
import { projectRunout, money, runwayPhrase } from "@/lib/ad-budget";
import { fullDate, cn } from "@/lib/utils";

export interface LedgerEntryDTO {
  id: string;
  kind: string;
  delta: number;
  balanceAfter: number;
  note: string | null;
  occurredAt: string;
}

export interface AdAccountDTO {
  id: string;
  name: string;
  platform: string;
  externalId: string | null;
  currency: string;
  balance: number;
  dailyBudget: number;
  thresholdDays: number;
  active: boolean;
  notes: string | null;
  ledger: LedgerEntryDTO[];
}

const SEVERITY_UI: Record<
  string,
  { label: string; tone: "green" | "amber" | "danger" | "default"; bar: string }
> = {
  ok: { label: "Healthy", tone: "green", bar: "var(--green)" },
  warn: { label: "Top up soon", tone: "amber", bar: "var(--amber)" },
  critical: { label: "Top up now", tone: "danger", bar: "var(--red)" },
  empty: { label: "Out of budget", tone: "danger", bar: "var(--red)" },
};

/** Ad Budget Watch — accounts, runway, and top-up reminders. */
export function AdBudgetWorkspace({
  initial,
  channelReady,
}: {
  initial: AdAccountDTO[];
  channelReady: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const active = initial.filter((a) => a.active);

  // Portfolio rollup.
  const summary = useMemo(() => {
    const now = new Date();
    let totalBalance = 0;
    let dailyBurn = 0;
    let needAttention = 0;
    let soonest: { name: string; days: number } | null = null;
    for (const a of active) {
      totalBalance += a.balance;
      dailyBurn += a.dailyBudget;
      const p = projectRunout(a, now);
      if (p.needsTopUp) needAttention += 1;
      if (p.daysLeft !== Infinity) {
        if (!soonest || p.daysLeft < soonest.days)
          soonest = { name: a.name, days: p.daysLeft };
      }
    }
    return { totalBalance, dailyBurn, needAttention, soonest };
  }, [active]);

  const runCheck = async (test: boolean) => {
    setChecking(true);
    try {
      const res = await fetch("/api/ad-accounts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      if (test) {
        toast({
          title: data.delivered
            ? "Test alert pushed — check your phone"
            : "No push channel wired yet",
          description: data.delivered
            ? "Discord should have buzzed."
            : "Add DISCORD_WEBHOOK_URL to send real alerts.",
          tone: data.delivered ? "success" : "info",
        });
      } else {
        const pushed = (data.alerted ?? []).filter(
          (o: { alerted: boolean }) => o.alerted,
        ).length;
        toast({
          title: pushed
            ? `${pushed} alert${pushed === 1 ? "" : "s"} sent`
            : "All accounts healthy — no alerts needed",
          tone: pushed ? "success" : "success",
        });
      }
      router.refresh();
    } catch (e) {
      toast({
        title: "Check failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Push-channel status banner */}
      {!channelReady ? (
        <div className="surface flex items-start gap-3 rounded-card border-l-2 border-l-[var(--amber)] p-4">
          <BellRing size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-ink">
              Phone alerts aren&apos;t wired yet.
            </p>
            <p className="mt-0.5 text-muted">
              Reminders still log here, but to get a push on your phone add a{" "}
              <span className="text-ink">Discord webhook</span> URL as{" "}
              <code className="rounded bg-[var(--panel-soft)] px-1 py-0.5 text-xs">
                DISCORD_WEBHOOK_URL
              </code>{" "}
              in the environment, then install Discord mobile. Test it with the
              button below once set.
            </p>
          </div>
        </div>
      ) : null}

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total on accounts"
          value={money(summary.totalBalance)}
          icon={Wallet}
          tone="accent"
        />
        <StatTile
          label="Daily burn"
          value={money(summary.dailyBurn)}
          sub="across active accounts"
          icon={TrendingDown}
        />
        <StatTile
          label="Soonest runout"
          value={
            summary.soonest
              ? summary.soonest.days < 1
                ? "Today"
                : `${Math.floor(summary.soonest.days)}d`
              : "—"
          }
          sub={summary.soonest ? summary.soonest.name : "no spend set"}
          icon={Gauge}
          tone={
            summary.soonest && summary.soonest.days <= 2 ? "danger" : "default"
          }
        />
        <StatTile
          label="Need a top-up"
          value={summary.needAttention}
          sub={summary.needAttention === 0 ? "all healthy" : "act now"}
          icon={AlertTriangle}
          tone={summary.needAttention > 0 ? "danger" : "green"}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} aria-hidden />
          Add account
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={checking}
          onClick={() => runCheck(false)}
        >
          <RefreshCw
            size={14}
            className={cn(checking && "animate-spin")}
            aria-hidden
          />
          Check now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={checking}
          onClick={() => runCheck(true)}
        >
          <BellRing size={14} aria-hidden />
          Send test alert
        </Button>
      </div>

      {/* Accounts */}
      {initial.length === 0 ? (
        <div className="surface rounded-card p-8 text-center">
          <Gauge size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink">No accounts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Add your Google Ads account, set the daily budget, and log your
            current balance. The hub projects when it runs dry and reminds you
            to top up before the card declines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {initial.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      )}

      <AddAccountModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AccountCard({ account }: { account: AdAccountDTO }) {
  const router = useRouter();
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const p = useMemo(() => projectRunout(account), [account]);
  const ui = SEVERITY_UI[p.severity] ?? SEVERITY_UI.ok;

  // Runway meter: fill = days left vs a 14-day full bar, capped.
  const fillPct =
    p.daysLeft === Infinity
      ? 100
      : Math.max(3, Math.min(100, (p.daysLeft / 14) * 100));

  return (
    <div className="surface flex flex-col gap-4 rounded-card p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-ink">
              {account.name}
            </p>
            {!account.active ? (
              <span className="rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                Paused
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            {account.platform}
            {account.externalId ? ` · ${account.externalId}` : ""}
          </p>
        </div>
        <span
          className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background:
              ui.tone === "green"
                ? "var(--green-soft)"
                : ui.tone === "amber"
                  ? "var(--amber-soft)"
                  : "var(--red-soft)",
            color:
              ui.tone === "green"
                ? "var(--green)"
                : ui.tone === "amber"
                  ? "var(--amber)"
                  : "var(--red)",
          }}
        >
          {ui.label}
        </span>
      </div>

      {/* Balance + runway */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-muted uppercase">
            Balance
          </p>
          <p className="num mt-0.5 text-3xl font-semibold text-ink">
            {money(account.balance, account.currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-lg font-semibold text-ink">
            {runwayPhrase(p)}
          </p>
          <p className="text-xs text-muted">
            {p.runoutDate
              ? `runs dry ${fullDate(p.runoutDate.toISOString())}`
              : "set a daily budget"}
          </p>
        </div>
      </div>

      {/* Runway meter */}
      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-soft)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${fillPct}%`, background: ui.bar }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>
            {money(account.dailyBudget, account.currency)}/day
          </span>
          <span>
            Remind ≤ {account.thresholdDays}d left ({money(p.thresholdAmount, account.currency)})
          </span>
        </div>
      </div>

      {p.needsTopUp && p.suggestedTopUp > 0 ? (
        <div className="flex items-center gap-2 rounded-control bg-[var(--red-soft)] px-3 py-2 text-xs text-danger">
          <AlertTriangle size={13} aria-hidden />
          Top up ~{money(p.suggestedTopUp, account.currency)} to restore ~2
          weeks of runway.
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDepositOpen(true)}
        >
          <DollarSign size={13} aria-hidden />
          Add funds
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={13} aria-hidden />
          Settings
        </Button>
      </div>

      {/* Recent ledger */}
      {account.ledger.length > 0 ? (
        <div className="border-t border-hairline pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted uppercase">
            Recent activity
          </p>
          <ul className="flex flex-col gap-1.5">
            {account.ledger.slice(0, 4).map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="num font-medium"
                  style={{
                    color: e.delta >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {money(e.delta, account.currency)}
                </span>
                <span className="truncate text-muted">
                  {e.note ?? (e.kind === "deposit" ? "Top-up" : "Adjustment")}
                </span>
                <span className="num ml-auto shrink-0 text-muted">
                  {fullDate(e.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DepositModal
        account={account}
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
      />
      <SettingsModal
        account={account}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleted={() => {
          toast({ title: "Account removed", tone: "info" });
          router.refresh();
        }}
      />
    </div>
  );
}

/* ----------------------------- modals ----------------------------- */

function AddAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("Google Ads");
  const [balance, setBalance] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [thresholdDays, setThresholdDays] = useState("3");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Name the account", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ad-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          platform: platform.trim() || "Google Ads",
          balance: Number(balance) || 0,
          dailyBudget: Number(dailyBudget) || 0,
          thresholdDays: Number(thresholdDays) || 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast({ title: "Account added", tone: "success" });
      setName("");
      setBalance("");
      setDailyBudget("");
      onClose();
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't add account",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add ad account"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={submit}>
            <Check size={13} aria-hidden />
            Add account
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <LabeledInput
          label="Account name"
          value={name}
          onChange={setName}
          placeholder="e.g. FDS — Google Ads"
        />
        <LabeledInput
          label="Platform"
          value={platform}
          onChange={setPlatform}
          placeholder="Google Ads"
        />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="Current balance"
            value={balance}
            onChange={setBalance}
            placeholder="100"
            type="number"
            prefix="$"
          />
          <LabeledInput
            label="Daily budget"
            value={dailyBudget}
            onChange={setDailyBudget}
            placeholder="40"
            type="number"
            prefix="$"
          />
        </div>
        <LabeledInput
          label="Remind me when runway drops to"
          value={thresholdDays}
          onChange={setThresholdDays}
          placeholder="3"
          type="number"
          suffix="days left"
          hint="You'll get a push once the account is this close to empty. 3 = nudge ~3 days out."
        />
      </div>
    </Modal>
  );
}

function DepositModal({
  account,
  open,
  onClose,
}: {
  account: AdAccountDTO;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"deposit" | "adjustment">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt)) {
      toast({ title: "Enter an amount", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/ad-accounts/${account.id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "deposit"
            ? { kind: "deposit", amount: Math.abs(amt), note: note.trim() || null }
            : { kind: "adjustment", setBalance: amt, note: note.trim() || "Balance correction" },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast({
        title: mode === "deposit" ? "Funds added" : "Balance corrected",
        tone: "success",
      });
      setAmount("");
      setNote("");
      onClose();
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't record it",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${account.name} — money`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={submit}>
            <Check size={13} aria-hidden />
            {mode === "deposit" ? "Add funds" : "Set balance"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* mode toggle */}
        <div className="flex gap-1 rounded-control bg-[var(--panel-soft)] p-1">
          {(["deposit", "adjustment"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "press flex-1 rounded-[7px] py-1.5 text-xs font-medium",
                mode === m
                  ? "bg-[var(--panel)] text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {m === "deposit" ? "Add funds" : "Correct balance"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Current balance:{" "}
          <span className="num text-ink">
            {money(account.balance, account.currency)}
          </span>
        </p>
        <LabeledInput
          label={mode === "deposit" ? "Amount to add" : "Actual balance now"}
          value={amount}
          onChange={setAmount}
          placeholder={mode === "deposit" ? "100" : "63.40"}
          type="number"
          prefix="$"
          hint={
            mode === "deposit"
              ? "How much you just topped the account up by."
              : "Snap the hub's balance to what Google Ads actually shows."
          }
        />
        <LabeledInput
          label="Note (optional)"
          value={note}
          onChange={setNote}
          placeholder={mode === "deposit" ? "Weekly top-up" : "Reconcile to platform"}
        />
      </div>
    </Modal>
  );
}

function SettingsModal({
  account,
  open,
  onClose,
  onDeleted,
}: {
  account: AdAccountDTO;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(account.name);
  const [dailyBudget, setDailyBudget] = useState(String(account.dailyBudget));
  const [thresholdDays, setThresholdDays] = useState(String(account.thresholdDays));
  const [active, setActive] = useState(account.active);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ad-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || account.name,
          dailyBudget: Number(dailyBudget) || 0,
          thresholdDays: Number(thresholdDays) || 3,
          active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast({ title: "Settings saved", tone: "success" });
      onClose();
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ad-accounts/${account.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      onClose();
      onDeleted();
    } catch {
      toast({ title: "Delete failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${account.name} — settings`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!confirmDelete ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={13} aria-hidden />
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted">Sure?</span>
              <Button variant="danger" size="sm" disabled={busy} onClick={del}>
                Yes, delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                <X size={13} aria-hidden />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={save}>
              <Check size={13} aria-hidden />
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <LabeledInput label="Account name" value={name} onChange={setName} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="Daily budget"
            value={dailyBudget}
            onChange={setDailyBudget}
            type="number"
            prefix="$"
          />
          <LabeledInput
            label="Remind at"
            value={thresholdDays}
            onChange={setThresholdDays}
            type="number"
            suffix="d left"
          />
        </div>
        <label className="flex items-center gap-2.5 rounded-control bg-[var(--panel-soft)] px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-ink">Active</span>
          <span className="text-xs text-muted">
            — paused accounts aren&apos;t watched or alerted.
          </span>
        </label>
      </div>
    </Modal>
  );
}

/* ---------------------------- primitives ---------------------------- */

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 text-sm text-muted">
            {prefix}
          </span>
        ) : null}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          className={cn(prefix && "pl-7", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 text-sm text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}
