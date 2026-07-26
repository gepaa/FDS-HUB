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

/** Centered dialog with scale + fade entrance. */
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

  // Callers pass `onClose` as an inline arrow, so its identity changes on
  // every render of the parent. Held in a ref, the effects below can
  // depend on `open` alone — otherwise every keystroke inside the dialog
  // re-ran them and the focus() below yanked the caret out of the input
  // the operator was typing in.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus the panel once, when the dialog opens — not on every render.
  useEffect(() => {
    if (!open) return;
    sound("whoosh");
    panelRef.current?.focus();
  }, [open, sound]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
            className={`surface-raised relative w-full rounded-panel outline-none ${widthClass}`}
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
