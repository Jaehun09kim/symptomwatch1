import { randomInt } from "node:crypto";

/** No I, O, 0 or 1: nothing a person can misread when a code is read aloud or copied. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

/** A role code: 8 characters (40 bits) from a CSPRNG, shown as XXXX-XXXX. */
export function generateJoinCode(): { code: string; display: string } {
  let code = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return { code, display: `${code.slice(0, 4)}-${code.slice(4)}` };
}

/** Case-, space- and dash-insensitive; null unless it is exactly a well-formed code. */
export function normalizeJoinCode(input: string): string | null {
  const normalized = input.toUpperCase().replace(/[\s-]/g, "");
  if (normalized.length !== JOIN_CODE_LENGTH) return null;
  for (const character of normalized) if (!JOIN_CODE_ALPHABET.includes(character)) return null;
  return normalized;
}
