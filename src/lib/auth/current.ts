import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppContext } from "@/lib/authz/context";
import { can, type Permission } from "@/lib/authz/permissions";
import { getEnv } from "@/lib/env";
import { resolveSession, SESSION_ABSOLUTE_MS, type SessionContext } from "./session-store";

export const SESSION_COOKIE = "sw_session";

/** Per-request memoized; never cached across requests (clinical data must not go stale after sign-out). */
export const getCurrentSession = cache(async (): Promise<SessionContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  return session;
}

export function toAppContext(session: SessionContext): AppContext {
  return {
    userId: session.userId,
    actorUserId: session.originalUserId ?? session.userId,
    clinicId: session.clinicId,
    role: session.role,
  };
}

/** For pages: redirects anonymous visitors to sign-in and other roles to the access-denied page. */
export async function requirePermission(permission: Permission): Promise<{ session: SessionContext; ctx: AppContext }> {
  const session = await requireSession();
  if (!can(session.role, permission)) redirect("/app/access-denied");
  return { session, ctx: toAppContext(session) };
}

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For Server Actions: throws instead of redirecting so the action can return a friendly error. */
export async function authorizeAction(permission?: Permission): Promise<{ session: SessionContext; ctx: AppContext }> {
  const session = await getCurrentSession();
  if (!session) throw new AuthorizationError("Your session has ended. Please sign in again.");
  if (permission && !can(session.role, permission)) throw new AuthorizationError();
  return { session, ctx: toAppContext(session) };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}
