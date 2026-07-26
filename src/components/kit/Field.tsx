"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-control border border-hairline bg-[var(--panel-soft)] px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors duration-200 aria-invalid:border-[var(--red)] aria-invalid:focus:ring-[var(--red-soft)]";

interface FieldProps {
  label: string;
  hint?: string;
  /** Inline validation message — replaces the hint and reddens the label. */
  error?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}

/** Labeled form row. Children receive the generated input id. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-xs font-medium",
          error ? "text-danger" : "text-muted",
        )}
      >
        {label}
      </label>
      {children(id)}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted">{hint}</p>
      ) : null}
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
