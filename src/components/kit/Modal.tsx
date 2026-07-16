"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { Button } from "@/components/kit/Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

/** Centered glass dialog with scale + fade entrance. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "max-w-md",
}: ModalProps) {
  const { sound } = useSound();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sound("whoosh");
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, sound]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
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
            className={`glass-strong relative w-full rounded-panel outline-none ${widthClass}`}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
              <Button
                variant="subtle"
                size="sm"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1"
              >
                <X size={15} aria-hidden />
              </Button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
