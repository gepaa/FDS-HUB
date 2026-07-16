"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { play } from "@/lib/sound";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(
  null,
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const iconColor = {
  success: "var(--green)",
  error: "var(--red)",
  info: "var(--muted)",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    const tone = t.tone ?? "info";
    setItems((prev) => [...prev.slice(-3), { ...t, tone, id }]);
    play(tone === "error" ? "error" : tone === "success" ? "success" : "tap");
    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-20 z-[70] flex w-80 flex-col gap-2 md:bottom-4"
      >
        <AnimatePresence>
          {items.map((item) => {
            const Icon = icons[item.tone ?? "info"];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.24, ease: [0.2, 0.8, 0.3, 1] }}
                className="surface-raised pointer-events-auto flex items-start gap-3 rounded-card px-4 py-3"
              >
                <Icon
                  size={17}
                  aria-hidden
                  style={{ color: iconColor[item.tone ?? "info"] }}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
