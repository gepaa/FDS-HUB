"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Plus, Search } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

interface SupplierHit {
  id: string;
  name: string;
  cluster: string;
}

/**
 * ⌘K command palette: jump to any panel, quick-add a supplier, or
 * fuzzy-find a supplier by name (fetched once per open).
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { sound } = useSound();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [suppliers, setSuppliers] = useState<SupplierHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        sound("whoosh");
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, sound]);

  // load supplier names when opened
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    fetch("/api/records?type=supplier")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SupplierHit[]) =>
        setSuppliers(
          (Array.isArray(data) ? data : []).map((s) => ({
            id: s.id,
            name: s.name,
            cluster: s.cluster,
          })),
        ),
      )
      .catch(() => setSuppliers([]));
    return () => window.clearTimeout(t);
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: PaletteEntry[] = NAV_ITEMS.filter(
      (n) => !q || n.label.toLowerCase().includes(q),
    ).map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      hint: n.description,
      icon: <n.icon size={15} aria-hidden />,
      run: () => router.push(n.href),
    }));
    const actions: PaletteEntry[] = [
      {
        id: "action-new-supplier",
        label: "Add supplier",
        hint: "Create a new CRM record",
        icon: <Plus size={15} aria-hidden />,
        run: () => router.push("/crm?new=1"),
      },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));
    const hits: PaletteEntry[] = q
      ? suppliers
          .filter((s) => s.name.toLowerCase().includes(q))
          .slice(0, 8)
          .map((s) => ({
            id: `sup-${s.id}`,
            label: s.name,
            hint: s.cluster,
            icon: <Search size={15} aria-hidden />,
            run: () => router.push(`/crm?supplier=${s.id}`),
          }))
      : [];
    return [...hits, ...actions, ...nav].slice(0, 12);
  }, [query, suppliers, router]);

  const select = (entry: PaletteEntry) => {
    sound("tap");
    onOpenChange(false);
    entry.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex justify-center p-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="glass-strong relative h-fit w-full max-w-lg overflow-hidden rounded-panel"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.3, 1] }}
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4">
              <Search size={16} className="text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, entries.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && entries[highlight]) {
                    select(entries[highlight]);
                  }
                }}
                placeholder="Type a supplier, panel, or action…"
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                aria-label="Search"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {entries.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted">
                  No matches.
                </li>
              ) : (
                entries.map((entry, i) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => select(entry)}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm",
                        i === highlight
                          ? "bg-[var(--accent-soft)] text-ink"
                          : "text-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "text-muted",
                          i === highlight && "text-accent-bright",
                        )}
                      >
                        {entry.icon}
                      </span>
                      <span className="font-medium text-ink">{entry.label}</span>
                      <span className="ml-auto truncate pl-4 text-xs text-muted">
                        {entry.hint}
                      </span>
                      {i === highlight && (
                        <CornerDownLeft
                          size={13}
                          className="shrink-0 text-muted"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
