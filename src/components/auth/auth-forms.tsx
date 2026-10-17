"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import {
  acceptInvitationAction,
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "@/app/(auth)/actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

const idle: FormState = { status: "idle" };

export interface DemoLogin {
  label: string;
  email: string;
}

export function SignInForm({ next, demoLogins, demoPassword, notice }: {
  next?: string;
  demoLogins: DemoLogin[];
  demoPassword?: string;
  notice?: string;
}) {
  const [state, action] = useActionState(signInAction, idle);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const fill = (login: DemoLogin) => {
    if (email.current) email.current.value = login.email;
    if (password.current && demoPassword) password.current.value = demoPassword;
  };
  return (
    <div className="space-y-6">
      {notice ? <FormMessage status="success" message={notice} /> : null}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <TextField ref={email} label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
        <TextField
          ref={password}
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
          labelAside={<Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">Forgot password?</Link>}
        />
        <FormMessage status={state.status} message={state.message} />
        <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
      {demoLogins.length && demoPassword ? (
        <section aria-labelledby="demo-logins" className="rounded-xl border border-border bg-surface p-4">
          <h2 id="demo-logins" className="text-sm font-semibold">Shared demo logins</h2>
          <p className="mt-1 text-xs text-slate-600">
            Fictional staff of the shared demo clinics. Password: <code className="rounded bg-white px-1 py-0.5 text-navy ring-1 ring-border">{demoPassword}</code>
          </p>
          <ul className="mt-3 grid gap-2">
            {demoLogins.map((login) => (
              <li key={login.email} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-border">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy">{login.label}</span>
                  <span className="block truncate text-xs text-slate-500">{login.email}</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => fill(login)} aria-label={`Fill sign-in form with ${login.label}`}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function SignUpForm({ inviteToken, invitedEmail }: { inviteToken?: string; invitedEmail?: string }) {
  const [state, action] = useActionState(signUpAction, idle);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="inviteToken" value={inviteToken ?? ""} />
      <TextField label="Your name" name="displayName" autoComplete="name" required error={errors.displayName} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={invitedEmail}
        readOnly={Boolean(invitedEmail)}
        error={errors.email}
        hint={invitedEmail ? "The invitation was sent to this address." : "Use any address you control; we don't send marketing email."}
      />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={10}
        error={errors.password} hint="At least 10 characters." />
      {!inviteToken ? (
        <TextField label="Demo clinic name (optional)" name="clinicName" autoComplete="organization" error={errors.clinicName}
          hint="We'll create a private demo workspace pre-filled with fictional patients." />
      ) : null}
      <CheckboxField name="noRealData" error={errors.noRealData}
        label="I understand this is a demo and I will only use fictional data — never real patient information." />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingLabel="Creating your workspace…">
        {inviteToken ? "Create account and join clinic" : "Create demo account"}
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, idle);
  if (state.status === "success") return <FormMessage status="success" message={state.message} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={10}
        error={state.fieldErrors?.password} hint="At least 10 characters." />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingLabel="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}
