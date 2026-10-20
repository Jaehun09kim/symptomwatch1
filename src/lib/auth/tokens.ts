import { createHmac, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/** 256-bit random bearer token (session, reset, invitation, join transaction, verification). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only keyed hashes of bearer tokens are stored. */
export function hashToken(token: string, purpose: "session" | "reset" | "invite" | "join_code" | "join" | "verify"): string {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`${purpose}:${token}`).digest("hex");
}
