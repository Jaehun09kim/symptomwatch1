import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

/** Best-effort client IP from proxy headers (first hop). */
export async function getClientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "unknown";
}

/** IPs are stored only as keyed hashes. */
export function hashIp(ip: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`ip:${ip}`).digest("hex").slice(0, 32);
}
