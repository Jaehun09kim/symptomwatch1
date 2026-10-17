"use client";

import { useId, type ComponentProps, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-[10px] border border-input bg-white px-3 text-[0.95rem] text-navy shadow-soft outline-none transition placeholder:text-slate-400 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-destructive disabled:bg-surface disabled:text-slate-500";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  labelAside?: ReactNode;
}

function FieldShell({ label, error, hint, children, labelAside }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-navy">{label}</label>
        {labelAside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  labelAside,
  className,
  ...input
}: ComponentProps<"input"> & { label: string; error?: string; hint?: ReactNode; labelAside?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint} labelAside={labelAside}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(controlClass, "h-11", className)} {...input} />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  ...input
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(controlClass, "py-2.5", className)} {...input} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(controlClass, "h-11", className)} {...select}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({ label, error, name, defaultChecked }: { label: ReactNode; error?: string; name: string; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-body">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 rounded border-input accent-brand" />
        <span>{label}</span>
      </label>
      {error ? <p id={`${id}-error`} className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel, className, size = "lg", variant }: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending} className={className}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}

export function FormMessage({ status, message }: { status: "idle" | "error" | "success"; message?: string }) {
  if (!message || status === "idle") return <div aria-live="polite" />;
  const success = status === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-sm",
        success ? "border-teal/30 bg-teal-soft text-teal-strong" : "border-destructive/30 bg-red-50 text-destructive",
      )}
    >
      {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{message}</span>
    </div>
  );
}
