"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { Button } from "@/components/kit/Button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

/** Right-hand glass drawer with blur overlay and spring slide-in. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = "w-full max-w-xl",
}: DrawerProps) {
  const { sound } = useSound();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sound("whoosh");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, sound]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`glass-strong absolute top-3 right-3 bottom-3 flex flex-col rounded-panel outline-none ${widthClass}`}
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {subtitle ? (
                  <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
                ) : null}
              </div>
              <Button
                variant="subtle"
                size="sm"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1"
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
            {footer ? (
              <div className="border-t border-hairline px-6 py-4">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
