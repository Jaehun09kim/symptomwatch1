"use client";

import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { attachJoinAction, continueJoinAction, enterClinicAction, startJoinAction, verifyEmailAction, withdrawJoinAction, type FormState } from "@/app/(auth)/actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

const idle: FormState = { status: "idle" };

/** Step 1: one box for the code the clinic's manager just gave you. */
export function JoinCodeForm() {
  const [state, onSubmit, pending] = useFormAction(startJoinAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <TextField label="Your code" name="code" required autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
        placeholder="XXXX-XXXX" maxLength={12} className="font-mono text-xl uppercase tracking-[0.14em]"
        hint="Codes are 8 letters and numbers and expire 90 seconds after your manager creates them." />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pending={pending} className="w-full" pendingLabel="Checking…">Continue</SubmitButton>
    </form>
  );
}

/** Step 2: create an account, or use the one you already have. */
export function JoinAccountForm() {
  const [mode, setMode] = useState<"sign_up" | "sign_in">("sign_up");
  const [state, onSubmit, pending] = useFormAction(attachJoinAction, idle);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Your account" className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        {([["sign_up", "I'm new here"], ["sign_in", "I already have an account"]] as const).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)}
            className={cn("min-h-9 rounded-sm px-3 font-medium transition-colors", mode === value ? "bg-card text-navy shadow-soft" : "text-slate-600 hover:text-navy")}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" name="mode" value={mode} />
        {mode === "sign_up" ? <TextField label="Your name" name="displayName" autoComplete="name" required error={errors.displayName} /> : null}
        <TextField label="Email" name="email" type="email" autoComplete="email" required error={errors.email}
          hint={mode === "sign_up" ? "We'll send a link to confirm it's yours." : undefined} />
        <TextField label="Password" name="password" type="password" autoComplete={mode === "sign_up" ? "new-password" : "current-password"} required
          error={errors.password} hint={mode === "sign_up" ? "At least 10 characters." : undefined} />
        {mode === "sign_up" ? (
          <CheckboxField name="noRealData" error={errors.noRealData}
            label="I understand this is a demo and I will only use fictional data — never real patient information." />
        ) : null}
        <FormMessage status={state.status} message={state.message} />
        <SubmitButton pending={pending} className="w-full" pendingLabel="Working…">Continue</SubmitButton>
      </form>
    </div>
  );
}

/** A deliberate click consumes the link, so mail scanners that prefetch it can't. */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, onSubmit, pending] = useFormAction(verifyEmailAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pending={pending} className="w-full" pendingLabel="Confirming…">Confirm my email</SubmitButton>
    </form>
  );
}

/** On the check-email page: finish once the email was confirmed (possibly on another device). */
export function ContinueJoinForm() {
  const [state, onSubmit, pending] = useFormAction(continueJoinAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pending={pending} className="w-full" pendingLabel="Checking…">I&rsquo;ve confirmed my email — continue</SubmitButton>
    </form>
  );
}

export function EnterClinicForm({ clinicId }: { clinicId: string }) {
  const [state, onSubmit, pending] = useFormAction(enterClinicAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pending={pending} className="w-full" pendingLabel="Opening…">Enter clinic</SubmitButton>
    </form>
  );
}

export function WithdrawJoinForm({ requestId }: { requestId: string }) {
  const [state, onSubmit, pending] = useFormAction(withdrawJoinAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton pending={pending} size="default" variant="outline" pendingLabel="…">Withdraw request</SubmitButton>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
