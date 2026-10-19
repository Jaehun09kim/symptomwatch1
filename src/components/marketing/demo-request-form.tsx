"use client";

import { useId } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { CheckCircle2, Loader2 } from "lucide-react";
import { requestDemoAction, type DemoRequestState } from "@/app/(marketing)/actions";
import { Button } from "@/components/ui/button";
import { CLINIC_SIZES, DEMO_REQUEST_ROLES } from "@/lib/validation/demo-request";
import { cn } from "@/lib/utils";

const initial: DemoRequestState = { status: "idle" };

const control =
  "w-full rounded-md border border-input bg-white/[0.03] px-3 text-[0.9375rem] text-navy outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-500 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-destructive";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-navy">
        {label}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function DemoRequestForm() {
  const [state, onSubmit, pending] = useFormAction(requestDemoAction, initial);
  const base = useId();
  const id = (name: string) => `${base}-${name}`;
  const err = state.fieldErrors ?? {};
  const describedBy = (name: string, hint = false) =>
    err[name] ? `${id(name)}-error` : hint ? `${id(name)}-hint` : undefined;

  if (state.status === "success") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-teal/30 bg-teal-soft p-5 text-teal-strong">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("name")} label="Your name" error={err.name}>
          <input id={id("name")} name="name" autoComplete="name" required className={cn(control, "h-10")}
            aria-invalid={Boolean(err.name)} aria-describedby={describedBy("name")} />
        </Field>
        <Field id={id("email")} label="Work email" error={err.email}>
          <input id={id("email")} name="email" type="email" autoComplete="email" required className={cn(control, "h-10")}
            aria-invalid={Boolean(err.email)} aria-describedby={describedBy("email")} />
        </Field>
      </div>
      <Field id={id("clinicName")} label="Clinic name" error={err.clinicName}>
        <input id={id("clinicName")} name="clinicName" autoComplete="organization" required className={cn(control, "h-10")}
          aria-invalid={Boolean(err.clinicName)} aria-describedby={describedBy("clinicName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("role")} label="Your role" error={err.role}>
          <select id={id("role")} name="role" defaultValue="" required className={cn(control, "h-10")}
            aria-invalid={Boolean(err.role)} aria-describedby={describedBy("role")}>
            <option value="" disabled>Select…</option>
            {DEMO_REQUEST_ROLES.map((role) => <option key={role}>{role}</option>)}
          </select>
        </Field>
        <Field id={id("clinicSize")} label="Clinic size" error={err.clinicSize}>
          <select id={id("clinicSize")} name="clinicSize" defaultValue="" required className={cn(control, "h-10")}
            aria-invalid={Boolean(err.clinicSize)} aria-describedby={describedBy("clinicSize")}>
            <option value="" disabled>Select…</option>
            {CLINIC_SIZES.map((size) => <option key={size}>{size}</option>)}
          </select>
        </Field>
      </div>
      <Field id={id("message")} label="What would you like to see? (optional)" error={err.message}
        hint="Describe your workflow — never include patient names, dates of birth, or record numbers.">
        <textarea id={id("message")} name="message" rows={4} maxLength={1000} className={cn(control, "py-2.5")}
          aria-invalid={Boolean(err.message)} aria-describedby={describedBy("message", true)} />
      </Field>
      {/* Honeypot — hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm text-body">
          <input type="checkbox" name="noPatientInfo" required
            className="mt-0.5 size-5 shrink-0 rounded border-input accent-brand"
            aria-invalid={Boolean(err.noPatientInfo)} aria-describedby={describedBy("noPatientInfo")} />
          <span>I will not include any patient information in this request.</span>
        </label>
        {err.noPatientInfo ? <p id={`${id("noPatientInfo")}-error`} className="text-sm text-destructive">{err.noPatientInfo}</p> : null}
      </div>
      <div aria-live="polite" className="min-h-5 text-sm text-destructive">
        {state.status === "error" ? state.message : null}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Sending…" : "Request a walkthrough"}
      </Button>
    </form>
  );
}
