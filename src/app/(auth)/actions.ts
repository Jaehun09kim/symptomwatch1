"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  acceptInvitationAsUser,
  recordSignOut,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  signInWithPassword,
} from "@/lib/auth/accounts";
import { clearSessionCookie, getCurrentSession, SESSION_COOKIE, setSessionCookie } from "@/lib/auth/current";
import { deleteSessionByToken, resolveSession } from "@/lib/auth/session-store";
import { attachJoinAccount, continueJoin, enterApprovedClinic, startJoin, verifyEmailAndJoin, withdrawJoin, type JoinStep } from "@/lib/auth/joining";
import { getEnv } from "@/lib/env";
import type { MemberRole } from "@/lib/labels";
import { rateLimiter, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request";
import { provisionTryDemo, returnToOwnAccount, startViewAs } from "@/lib/services/demo-sandbox";
import {
  fieldErrorsFrom,
  forgotPasswordSchema,
  resetPasswordSchema,
  joinNewAccountSchema,
  signInSchema,
  signUpSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
}

async function requestMeta() {
  const ip = await getClientIp();
  return { ip, ipHash: hashIp(ip), userAgent: (await headers()).get("user-agent") };
}

/** Front-desk staff start on their queue; clinicians and admins on the dashboard. */
function landingFor(role: MemberRole | undefined): string {
  return role === "staff" ? "/app/queue" : "/app";
}

function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value : "";
  return /^\/(app|invite)(\/|$)/.test(next) ? next : null;
}

const tooMany = (): FormState => ({ status: "error", message: "Too many attempts. Please wait a few minutes and try again." });

export async function signInAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const meta = await requestMeta();
  const limiter = rateLimiter();
  if (!limiter.check(`sign-in:ip:${meta.ip}`, RATE_LIMITS.signIn).allowed ||
      !limiter.check(`sign-in:email:${parsed.data.email}`, RATE_LIMITS.signIn).allowed) return tooMany();

  const result = await signInWithPassword(parsed.data, meta);
  if (!result.ok) return { status: "error", message: result.error };
  if ("pending" in result) {
    await rotateSession(result);
    redirect("/join/waiting");
  }
  const session = await rotateSession(result);
  redirect(safeNext(form.get("next")) ?? landingFor(session?.role));
}

/**
 * Session rotation: install the new session cookie and delete the previous
 * session row, then return the new session (resolved by token because the
 * cookie set in this request isn't visible to cookies() yet).
 */
async function rotateSession(grant: { token: string; expiresAt: Date }) {
  const previous = (await cookies()).get(SESSION_COOKIE)?.value;
  await setSessionCookie(grant.token, grant.expiresAt);
  if (previous && previous !== grant.token) await deleteSessionByToken(previous);
  return resolveSession(grant.token);
}

export async function signUpAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    password: form.get("password"),
    clinicName: form.get("clinicName") ?? "",
    inviteToken: form.get("inviteToken") ?? "",
    noRealData: form.get("noRealData") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const meta = await requestMeta();
  if (!rateLimiter().check(`sign-up:${meta.ip}`, RATE_LIMITS.signUp).allowed) return tooMany();

  const result = await registerAccount(parsed.data, meta);
  if (!result.ok) {
    return result.field
      ? { status: "error", fieldErrors: { [result.field]: result.error } }
      : { status: "error", message: result.error };
  }
  const session = await rotateSession(result);
  redirect(`${landingFor(session?.role)}?welcome=1`);
}

export async function signOutAction(): Promise<void> {
  const session = await getCurrentSession();
  const token = await clearSessionCookie();
  if (token) await deleteSessionByToken(token);
  if (session) await recordSignOut(session);
  redirect("/sign-in?signedOut=1");
}

export async function forgotPasswordAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const meta = await requestMeta();
  if (!rateLimiter().check(`reset:${meta.ip}`, RATE_LIMITS.passwordReset).allowed) return tooMany();
  await requestPasswordReset(parsed.data.email, meta);
  return {
    status: "success",
    message: "If an account exists for that email, a reset link is on its way. In local demo mode, open the developer outbox to see it.",
  };
}

export async function resetPasswordAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: form.get("token"),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const result = await resetPassword(parsed.data, await requestMeta());
  if (!result.ok) {
    return result.field
      ? { status: "error", fieldErrors: { [result.field]: result.error } }
      : { status: "error", message: result.error };
  }
  redirect("/sign-in?reset=1");
}

export async function acceptInvitationAction(_previous: FormState, form: FormData): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) return { status: "error", message: "Sign in first." };
  const token = String(form.get("token") ?? "");
  const result = await acceptInvitationAsUser(token, { id: session.originalUserId ?? session.userId, email: session.email }, await requestMeta());
  if (!result.ok) return { status: "error", message: result.error };
  await rotateSession(result);
  redirect("/app?joined=1");
}

const DEMO_ROLES = new Set<MemberRole>(["physician", "staff", "clinic_admin"]);

export async function startTryDemoAction(form: FormData): Promise<void> {
  const role = String(form.get("role")) as MemberRole;
  if (!DEMO_ROLES.has(role)) redirect("/demo?error=role");
  const meta = await requestMeta();
  if (!rateLimiter().check(`demo:${meta.ip}`, RATE_LIMITS.demoProvision).allowed) redirect("/demo?error=rate");
  await rotateSession(await provisionTryDemo(role, meta));
  redirect(`${landingFor(role)}?welcome=demo`);
}

export async function viewAsAction(form: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const result = await startViewAs(session, String(form.get("userId") ?? ""), await requestMeta());
  if (!result.ok) redirect("/app?error=view-as");
  redirect(landingFor((await rotateSession(result))?.role));
}

export async function returnToOwnAccountAction(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const result = await returnToOwnAccount(session, await requestMeta());
  if (!result.ok) redirect("/app?error=view-as");
  await rotateSession(result);
  redirect("/app");
}

// ── Joining a clinic with a code (onboarding M2) ───────────────────────────
const JOIN_COOKIE = "sw_join";
const JOIN_COOKIE_MAX_AGE = 15 * 60;

async function setJoinCookie(token: string): Promise<void> {
  (await cookies()).set(JOIN_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: getEnv().NODE_ENV === "production", path: "/", maxAge: JOIN_COOKIE_MAX_AGE,
  });
}

export async function readJoinCookie(): Promise<string | undefined> {
  return (await cookies()).get(JOIN_COOKIE)?.value;
}

async function clearJoinCookie(): Promise<void> {
  (await cookies()).delete(JOIN_COOKIE);
}

/** Lands a finished join step: a clinic session, an identity-only waiting session, or "check your email". */
async function landJoinStep(step: JoinStep): Promise<FormState> {
  if (!step.ok) {
    return step.field ? { status: "error", fieldErrors: { [step.field]: step.error } } : { status: "error", message: step.error };
  }
  if (step.next === "verify_email") redirect(`/join/check-email?email=${encodeURIComponent(step.email)}`);
  if (step.next === "verified") redirect("/join/check-email?confirmed=1");
  await clearJoinCookie();
  if (step.next === "waiting") {
    await rotateSession(step.session);
    redirect("/join/waiting");
  }
  const session = await rotateSession(step.session);
  redirect(`${landingFor(session?.role)}?joined=1`);
}

export async function startJoinAction(_previous: FormState, form: FormData): Promise<FormState> {
  const meta = await requestMeta();
  const result = await startJoin(String(form.get("code") ?? ""), meta);
  if (!result.ok) return { status: "error", message: result.error };
  await setJoinCookie(result.token);
  redirect("/join/confirm");
}

export async function attachJoinAction(_previous: FormState, form: FormData): Promise<FormState> {
  const token = await readJoinCookie();
  if (!token) return { status: "error", message: "This join has expired. Ask your clinic for a new code." };
  const meta = await requestMeta();
  if (form.get("mode") === "sign_in") {
    const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
    if (!rateLimiter().check(`sign-in:ip:${meta.ip}`, RATE_LIMITS.signIn).allowed) return tooMany();
    return landJoinStep(await attachJoinAccount(token, { mode: "sign_in", ...parsed.data }, meta));
  }
  const parsed = joinNewAccountSchema.safeParse({
    displayName: form.get("displayName"), email: form.get("email"), password: form.get("password"), noRealData: form.get("noRealData") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!rateLimiter().check(`sign-up:${meta.ip}`, RATE_LIMITS.signUp).allowed) return tooMany();
  return landJoinStep(await attachJoinAccount(token, { mode: "sign_up", displayName: parsed.data.displayName, email: parsed.data.email, password: parsed.data.password }, meta));
}

export async function verifyEmailAction(_previous: FormState, form: FormData): Promise<FormState> {
  return landJoinStep(await verifyEmailAndJoin(String(form.get("token") ?? ""), await readJoinCookie(), await requestMeta()));
}

/** "I've confirmed my email" on the check-email page, from the browser that entered the code. */
export async function continueJoinAction(): Promise<FormState> {
  const token = await readJoinCookie();
  if (!token) return { status: "error", message: "This join has expired. Ask your clinic for a new code." };
  return landJoinStep(await continueJoin(token, await requestMeta()));
}

export async function enterClinicAction(_previous: FormState, form: FormData): Promise<FormState> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/sign-in");
  const grant = await enterApprovedClinic(token, String(form.get("clinicId") ?? ""), await requestMeta());
  if (!grant.ok) return { status: "error", message: grant.error };
  const session = await rotateSession(grant);
  redirect(`${landingFor(session?.role)}?joined=1`);
}

export async function withdrawJoinAction(_previous: FormState, form: FormData): Promise<FormState> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/sign-in");
  const result = await withdrawJoin(token, String(form.get("requestId") ?? ""));
  return result.ok ? { status: "success", message: "Request withdrawn." } : { status: "error", message: "That request can't be withdrawn now." };
}
