import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-of-request hygiene only. Authorization happens in Server Actions,
 * Server Components, and services — never solely here.
 */
const PRIVATE_PREFIXES = ["/app", "/api", "/dev", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/invite", "/join", "/verify-email"];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (isPrivatePath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|opengraph-image).*)"],
};
