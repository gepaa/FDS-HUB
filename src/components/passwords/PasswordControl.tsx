"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LockOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { Button } from "@/components/kit/Button";
import { Modal } from "@/components/kit/Modal";
import { useToast } from "@/components/kit/Toast";
import { cn, shortDate } from "@/lib/utils";

interface CredentialRow {
  id: string;
  service: string;
  label: string | null;
  username: string | null;
  url: string | null;
  category: string;
  notes: string | null;
  updatedAt: string;
  lastRevealedAt: string | null;
}

/** A revealed secret auto-hides after this long. */
const REVEAL_MS = 45_000;

const EMPTY_DRAFT = {
  service: "",
  label: "",
  username: "",
  secret: "",
  url: "",
  category: "Other",
  notes: "",
};

export function PasswordControl({
  configured,
  initialUnlocked,
}: {
  configured: boolean;
  initialUnlocked: boolean;
}) {
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CredentialRow | null>(
    null,
  );
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials");
      if (res.status === 401) {
        setUnlocked(false);
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? "Load failed");
      setRows(await res.json());
    } catch (e) {
      toast({ title: `Could not load the vault: ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked, load]);

  // Never leave a decrypted secret behind in memory on unmount.
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/vault/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        toast({ title: (await res.json()).error ?? "Incorrect password" });
        return;
      }
      setPassphrase("");
      setUnlocked(true);
    } finally {
      setUnlocking(false);
    }
  };

  const lock = async () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    setRevealed({});
    setRows([]);
    await fetch("/api/vault/unlock", { method: "DELETE" });
    setUnlocked(false);
  };

  const reveal = async (row: CredentialRow) => {
    if (revealed[row.id]) {
      clearTimeout(timers.current[row.id]);
      delete timers.current[row.id];
      setRevealed((r) => {
        const next = { ...r };
        delete next[row.id];
        return next;
      });
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/credentials/${row.id}/reveal`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Could not reveal" });
        return;
      }
      setRevealed((r) => ({ ...r, [row.id]: data.secret }));
      timers.current[row.id] = setTimeout(() => {
        setRevealed((r) => {
          const next = { ...r };
          delete next[row.id];
          return next;
        });
      }, REVEAL_MS);
      setRows((rs) =>
        rs.map((x) =>
          x.id === row.id
            ? { ...x, lastRevealedAt: new Date().toISOString() }
            : x,
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (row: CredentialRow) => {
    setBusyId(row.id);
    try {
      let secret = revealed[row.id];
      if (!secret) {
        const res = await fetch(`/api/credentials/${row.id}/reveal`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: data.error ?? "Could not copy" });
          return;
        }
        secret = data.secret;
      }
      await navigator.clipboard.writeText(secret!);
      toast({ title: `${row.service} password copied` });
    } catch {
      toast({ title: "Clipboard blocked by the browser" });
    } finally {
      setBusyId(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.service.trim() || !draft.secret) {
      toast({ title: "Service and password are both required" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save" });
        return;
      }
      setRows((r) => [...r, data]);
      setDraft({ ...EMPTY_DRAFT });
      setAdding(false);
      toast({ title: `${data.service} added` });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CredentialRow) => {
    const res = await fetch(`/api/credentials/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast({ title: "Could not delete" });
      return;
    }
    setRows((r) => r.filter((x) => x.id !== row.id));
    setConfirmDelete(null);
    toast({ title: `${row.service} removed` });
  };

  const grouped = useMemo(() => {
    const by = new Map<string, CredentialRow[]>();
    for (const r of rows) {
      const list = by.get(r.category) ?? [];
      list.push(r);
      by.set(r.category, list);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // ---------- not configured ----------
  if (!configured) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <GlassPanel className="p-6">
          <p className="text-sm font-semibold text-ink">
            Vault not configured on this server
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Password Control needs two environment variables before it will
            store anything. Without them it refuses to open rather than
            falling back to storing your passwords in the clear.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
            <li>
              <code className="num text-ink">CREDENTIAL_KEY</code> — the
              encryption key. Generate with{" "}
              <code className="num text-ink">openssl rand -base64 32</code>.
            </li>
            <li>
              <code className="num text-ink">PASSWORD_CONTROL_PASSPHRASE</code>{" "}
              — what you type to unlock this page.
            </li>
          </ul>
          <p className="mt-3 max-w-xl text-xs text-muted">
            Keep <code className="num">CREDENTIAL_KEY</code> out of the repo and
            back it up somewhere safe — lose it and every stored password
            becomes unreadable.
          </p>
        </GlassPanel>
      </div>
    );
  }

  // ---------- locked ----------
  if (!unlocked) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <GlassPanel className="mx-auto w-full max-w-md p-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-control"
              style={{ background: "var(--accent-soft)" }}
            >
              <Lock size={17} className="text-accent-bright" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Vault locked</p>
              <p className="text-xs text-muted">
                Unlocks for 30 minutes, then re-locks on its own.
              </p>
            </div>
          </div>
          <form onSubmit={unlock} className="mt-4 flex flex-col gap-2">
            <label htmlFor="vault-pass" className="sr-only">
              Vault password
            </label>
            <input
              id="vault-pass"
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Password"
              className="surface-muted h-10 w-full rounded-control px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <Button type="submit" disabled={unlocking || !passphrase.trim()}>
              <LockOpen size={15} aria-hidden />
              {unlocking ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
        </GlassPanel>
      </div>
    );
  }

  // ---------- unlocked ----------
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Header />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden />
            Add entry
          </Button>
          <Button variant="ghost" onClick={lock}>
            <Lock size={15} aria-hidden />
            Lock
          </Button>
        </div>
      </div>

      {loading ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-muted">Opening the vault…</p>
        </GlassPanel>
      ) : rows.length === 0 ? (
        <GlassPanel className="p-6">
          <p className="text-sm font-semibold text-ink">Vault is empty</p>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Nothing stored yet. Add your first entry — the password is
            encrypted before it reaches the database, and only ever comes back
            out when you press Reveal.
          </p>
          <Button className="mt-4" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden />
            Add entry
          </Button>
        </GlassPanel>
      ) : (
        grouped.map(([category, list]) => (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="text-[11px] font-medium tracking-wider text-muted uppercase">
              {category}
              <span className="num ml-2 text-ink">{list.length}</span>
            </h2>
            <GlassPanel>
              <ul className="divide-y divide-[var(--hairline)]">
                {list.map((row) => {
                  const isOpen = Boolean(revealed[row.id]);
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {row.service}
                          {row.label ? (
                            <span className="ml-2 text-xs font-normal text-muted">
                              {row.label}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {row.username || "no username"}
                          {row.url ? (
                            <>
                              {" · "}
                              <a
                                href={
                                  /^https?:\/\//i.test(row.url)
                                    ? row.url
                                    : `https://${row.url}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-bright hover:underline"
                              >
                                {row.url}
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>

                      <code
                        className={cn(
                          "num surface-muted min-w-[9rem] rounded-control px-2.5 py-1.5 text-sm",
                          isOpen ? "text-ink" : "text-muted",
                        )}
                      >
                        {isOpen ? revealed[row.id] : "••••••••••"}
                      </code>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => reveal(row)}
                          disabled={busyId === row.id}
                          aria-label={
                            isOpen
                              ? `Hide ${row.service} password`
                              : `Reveal ${row.service} password`
                          }
                        >
                          {isOpen ? (
                            <EyeOff size={15} aria-hidden />
                          ) : (
                            <Eye size={15} aria-hidden />
                          )}
                          {isOpen ? "Hide" : "Reveal"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => copy(row)}
                          disabled={busyId === row.id}
                          aria-label={`Copy ${row.service} password`}
                        >
                          <Copy size={15} aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmDelete(row)}
                          aria-label={`Delete ${row.service}`}
                        >
                          <Trash2 size={15} aria-hidden />
                        </Button>
                      </div>

                      {row.lastRevealedAt ? (
                        <p className="w-full text-[11px] text-muted">
                          Last revealed {shortDate(row.lastRevealedAt)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          </section>
        ))
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add credential"
      >
        <form onSubmit={add} className="flex flex-col gap-3">
          {(
            [
              ["service", "Service", "e.g. Shopify", true],
              ["label", "Label (optional)", "which account", false],
              ["username", "Username / email", "", false],
              ["secret", "Password", "", true],
              ["url", "URL", "", false],
              ["category", "Category", "e.g. Store", false],
            ] as const
          ).map(([field, label, placeholder, required]) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">
                {label}
                {required ? " *" : ""}
              </span>
              <input
                type={field === "secret" ? "password" : "text"}
                autoComplete="off"
                required={required}
                placeholder={placeholder}
                value={draft[field]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [field]: e.target.value }))
                }
                className="surface-muted h-9 rounded-control px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Notes</span>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notes: e.target.value }))
              }
              className="surface-muted rounded-control px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Check size={15} aria-hidden />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete credential"
      >
        <p className="text-sm text-muted">
          Permanently delete{" "}
          <span className="font-medium text-ink">
            {confirmDelete?.service}
          </span>
          ? The stored password is destroyed with it and cannot be recovered.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => confirmDelete && remove(confirmDelete)}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl text-ink">
        <KeyRound size={20} className="text-accent-bright" aria-hidden />
        Password Control
      </h1>
      <p className="text-sm text-muted">
        Encrypted at rest · revealed one at a time · every reveal logged
      </p>
    </div>
  );
}
