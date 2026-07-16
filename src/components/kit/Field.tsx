"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-control border border-hairline bg-[var(--panel-soft)] px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors duration-200";

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}

/** Labeled form row. Children receive the generated input id. */
export function Field({ label, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn(controlClasses, className)} {...rest} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(controlClasses, "min-h-20 resize-y", className)}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select className={cn(controlClasses, "appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}
